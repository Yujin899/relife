import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    // Verify auth
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");

    if (!quizId) {
        return NextResponse.json({ error: "quizId is required" }, { status: 400 });
    }

    try {
        const snapshot = await adminDb
            .collection("questions")
            .where("quizId", "==", quizId)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "No questions found for this quiz" }, { status: 404 });
        }

        // Shuffle questions
        const allQuestions = snapshot.docs.map((doc) => doc.data());
        const shuffled = allQuestions.sort(() => Math.random() - 0.5);

        // Return questions with answers and explanations for immediate feedback
        const sanitized = shuffled.map((q) => ({
            ...q,
            type: q.type || (q.correctOptionIds ? "multi" : "single")
        }));

        return NextResponse.json({ questions: sanitized });
    } catch (error) {
        console.error("Error fetching questions:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}
