import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

interface BulkQuestionInput {
    text: string;
    options: { id: string; text: string }[];
    type: "single" | "multi";
    correctOptionId?: string;
    correctOptionIds?: string[];
    explanation?: string;
}

export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { quizId, subjectId, questions } = body as {
        quizId: string;
        subjectId: string;
        questions: BulkQuestionInput[]
    };

    if (!quizId || !subjectId || !questions || !Array.isArray(questions)) {
        return NextResponse.json({ error: "quizId, subjectId, and questions array are required" }, { status: 400 });
    }

    if (questions.length === 0) {
        return NextResponse.json({ error: "Questions array cannot be empty" }, { status: 400 });
    }

    // 1. Verify Quiz & Subject exist first
    const [quizDoc, subjectDoc] = await Promise.all([
        adminDb.collection("quizzes").doc(quizId).get(),
        adminDb.collection("subjects").doc(subjectId).get()
    ]);

    if (!quizDoc.exists) return NextResponse.json({ error: `Quiz not found: ${quizId}` }, { status: 404 });
    if (!subjectDoc.exists) return NextResponse.json({ error: `Subject not found: ${subjectId}` }, { status: 404 });

    try {
        const now = FieldValue.serverTimestamp();

        // Firestore batches are limited to 500 writes. 
        // We'll process in chunks of 400 to be safe (leaving room for count updates)
        const CHUNK_SIZE = 400;
        let processedCount = 0;

        for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
            const chunk = questions.slice(i, i + CHUNK_SIZE);
            const batch = adminDb.batch();

            for (const q of chunk as BulkQuestionInput[]) {
                // Basic validation
                if (!q.text || !q.options || q.options.length < 2) {
                    return NextResponse.json({ error: `Invalid question format: ${q.text || "Unnamed"}` }, { status: 400 });
                }

                if (q.type === "single" && !q.correctOptionId) {
                    return NextResponse.json({ error: `correctOptionId missing for: ${q.text}` }, { status: 400 });
                }

                if (q.type === "multi" && (!q.correctOptionIds || q.correctOptionIds.length === 0)) {
                    return NextResponse.json({ error: `correctOptionIds missing for: ${q.text}` }, { status: 400 });
                }

                const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const questionRef = adminDb.collection("questions").doc(questionId);

                const questionData: {
                    id: string;
                    quizId: string;
                    subjectId: string;
                    text: string;
                    options: { id: string; text: string }[];
                    type: string;
                    explanation: string;
                    createdAt: FieldValue;
                    correctOptionId?: string;
                    correctOptionIds?: string[];
                } = {
                    id: questionId,
                    quizId,
                    subjectId,
                    text: q.text,
                    options: q.options,
                    type: q.type || "single",
                    explanation: q.explanation || "",
                    createdAt: now,
                };

                if (q.type === "multi") {
                    questionData.correctOptionIds = q.correctOptionIds;
                } else {
                    questionData.correctOptionId = q.correctOptionId;
                }

                batch.set(questionRef, questionData);
            }

            // Update counts in the last batch or once per chunk? 
            // Incrementing counts is safer once at the end of each successful chunk.
            batch.update(adminDb.collection("quizzes").doc(quizId), {
                questionCount: FieldValue.increment(chunk.length),
            });
            batch.update(adminDb.collection("subjects").doc(subjectId), {
                questionCount: FieldValue.increment(chunk.length),
            });

            await batch.commit();
            processedCount += chunk.length;
        }

        return NextResponse.json({ success: true, count: processedCount });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Bulk upload error details:", {
            message: err.message,
            stack: err.stack,
            quizId,
            subjectId,
            questionCount: questions?.length
        });
        return NextResponse.json({
            error: "Failed to upload questions in bulk",
            details: err.message
        }, { status: 500 });
    }
}
