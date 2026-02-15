import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { calculateNextReview, promoteBox, demoteBox } from "@/lib/sr";

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const now = new Date();
        // 1. Fetch ALL study items for the user (single-field query does NOT need composite index)
        const snapshot = await adminDb
            .collection("study_progress")
            .where("userId", "==", uid)
            .limit(1000) // Safety cap
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ questions: [] });
        }

        // 2. Filter for due items in memory
        const dueItems = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter((item: Record<string, unknown>) => {
                const nextReview = item.nextReview as { toDate?: () => Date } | Date | string;
                if (!nextReview) return false;
                const nextReviewDate = (typeof nextReview === "object" && "toDate" in nextReview && typeof nextReview.toDate === "function")
                    ? nextReview.toDate()
                    : new Date(nextReview as string | Date);
                return nextReviewDate <= now;
            })
            .slice(0, 20) as { id: string; questionId: string; box: number; nextReview: Timestamp }[];

        if (dueItems.length === 0) {
            return NextResponse.json({ questions: [] });
        }

        const studyItems = dueItems;

        const questionIds = studyItems.map((item) => item.questionId);

        // Fetch question details (chunked because 'in' query limit is 30, we have 20)
        const questionsSnapshot = await adminDb
            .collection("questions")
            .where("id", "in", questionIds)
            .get();

        const questionsData = questionsSnapshot.docs.reduce((acc: Record<string, { id: string; text: string;[key: string]: unknown }>, doc) => {
            acc[doc.id] = doc.data() as { id: string; text: string;[key: string]: unknown };
            return acc;
        }, {});

        // Merge and return
        const finalQuestions = studyItems.map((item) => ({
            ...questionsData[item.questionId],
            studyProgress: {
                id: item.id,
                box: item.box,
                nextReview: item.nextReview,
            }
        })).filter(q => !!q.text); // Filter out any deleted questions

        return NextResponse.json({ questions: finalQuestions });
    } catch (error: unknown) {
        console.error("Error fetching review questions:", error);
        const err = error as { code?: number; message?: string };
        if (err.code === 9) { // FAILED_PRECONDITION (missing index)
            return NextResponse.json({
                error: "Review board requires a Firestore Index.",
                indexUrl: err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0]
            }, { status: 412 });
        }
        return NextResponse.json({ error: "Failed to fetch review questions" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const { results } = await request.json() as {
            results: { questionId: string; subjectId: string; correct: boolean }[];
        };

        if (!results || !Array.isArray(results)) {
            return NextResponse.json({ error: "Invalid results format" }, { status: 400 });
        }

        const batch = adminDb.batch();

        for (const res of results) {
            const studyProgressId = `${uid}_${res.subjectId}_${res.questionId}`;
            const studyRef = adminDb.collection("study_progress").doc(studyProgressId);

            const doc = await studyRef.get();
            const currentBox = doc.exists ? (doc.data()?.box || 1) : 1;

            if (res.correct) {
                const nextBox = promoteBox(currentBox);
                batch.set(studyRef, {
                    userId: uid,
                    subjectId: res.subjectId,
                    questionId: res.questionId,
                    box: nextBox,
                    nextReview: Timestamp.fromDate(calculateNextReview(nextBox)),
                    lastReviewedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            } else {
                const nextBox = demoteBox();
                batch.set(studyRef, {
                    userId: uid,
                    subjectId: res.subjectId,
                    questionId: res.questionId,
                    box: nextBox,
                    nextReview: Timestamp.fromDate(calculateNextReview(nextBox)),
                    lastReviewedAt: FieldValue.serverTimestamp(),
                    lastMistakeAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }

        await batch.commit();
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Error updating review results:", error);
        return NextResponse.json({ error: "Failed to update review results" }, { status: 500 });
    }
}
