import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

interface QuizData extends Record<string, string | number | boolean | undefined> {
    id: string;
    title: string;
    completed: boolean;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ subjectId: string }> }
) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { subjectId } = await params;

    try {
        const quizzesSnapshot = await adminDb
            .collection("quizzes")
            .where("subjectId", "==", subjectId)
            .get();

        if (quizzesSnapshot.empty) {
            return NextResponse.json({ error: "No quizzes found for this subject" }, { status: 404 });
        }

        // Fetch user attempts to check completion
        const attemptsSnapshot = await adminDb
            .collection("quiz_attempts")
            .where("userId", "==", authResult.uid)
            .where("subjectId", "==", subjectId)
            .get();

        const completedQuizIds = new Set(attemptsSnapshot.docs.map(doc => doc.data().quizId));

        const quizzes: QuizData[] = quizzesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: data.id,
                title: data.title,
                description: data.description,
                questionCount: data.questionCount,
                completed: completedQuizIds.has(data.id),
                ...data
            };
        });

        // Sort by title alphabetically
        quizzes.sort((a, b) => a.title.localeCompare(b.title));

        return NextResponse.json({ quizzes });
    } catch (error) {
        console.error("Error fetching quizzes:", error);
        return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 });
    }
}
