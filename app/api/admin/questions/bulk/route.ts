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

    try {
        const batch = adminDb.batch();
        const now = FieldValue.serverTimestamp();

        for (const q of questions) {
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

            const questionData: Record<string, any> = {
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

        // Update counts
        batch.update(adminDb.collection("quizzes").doc(quizId), {
            questionCount: FieldValue.increment(questions.length),
        });
        batch.update(adminDb.collection("subjects").doc(subjectId), {
            questionCount: FieldValue.increment(questions.length),
        });

        await batch.commit();

        return NextResponse.json({ success: true, count: questions.length });
    } catch (error) {
        console.error("Bulk upload error:", error);
        return NextResponse.json({ error: "Failed to upload questions in bulk" }, { status: 500 });
    }
}
