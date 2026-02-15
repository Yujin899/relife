import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

// GET — list questions (filtered by quizId)
export async function GET(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");
    if (!quizId) {
        return NextResponse.json({ error: "quizId is required" }, { status: 400 });
    }

    const snapshot = await adminDb.collection("questions").where("quizId", "==", quizId).get();
    const questions = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json({ questions });
}

// POST — create a new question
export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const {
        quizId,
        subjectId,
        text,
        options,
        correctOptionId,
        correctOptionIds,
        type = "single",
        explanation
    } = body;

    if (!quizId || !subjectId || !text || !options) {
        return NextResponse.json(
            { error: "quizId, subjectId, text, and options are required" },
            { status: 400 }
        );
    }

    if (type === "single" && !correctOptionId) {
        return NextResponse.json({ error: "correctOptionId is required for single-select questions" }, { status: 400 });
    }
    if (type === "multi" && (!correctOptionIds || correctOptionIds.length === 0)) {
        return NextResponse.json({ error: "At least one correctOptionId is required for multi-select questions" }, { status: 400 });
    }

    if (!Array.isArray(options) || options.length < 2) {
        return NextResponse.json({ error: "At least 2 options required" }, { status: 400 });
    }

    const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    interface QuestionData {
        id: string;
        quizId: string;
        subjectId: string;
        text: string;
        options: { id: string; text: string }[];
        type: string;
        createdAt: any;
        correctOptionId?: string;
        correctOptionIds?: string[];
        explanation?: string;
    }

    const questionData: QuestionData = {
        id: questionId,
        quizId,
        subjectId,
        text,
        options,
        type,
        createdAt: FieldValue.serverTimestamp(),
        explanation: explanation || "",
    };

    if (type === "multi") questionData.correctOptionIds = correctOptionIds;
    else questionData.correctOptionId = correctOptionId;

    await adminDb.collection("questions").doc(questionId).set(questionData);

    // Update counts
    const batch = adminDb.batch();
    batch.update(adminDb.collection("quizzes").doc(quizId), {
        questionCount: FieldValue.increment(1),
    });
    batch.update(adminDb.collection("subjects").doc(subjectId), {
        questionCount: FieldValue.increment(1),
    });
    await batch.commit();

    return NextResponse.json({ question: { id: questionId, quizId, text } }, { status: 201 });
}

// PUT — update a question
export async function PUT(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { id, text, options, correctOptionId, correctOptionIds, type, explanation } = body;
    if (!id) {
        return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const ref = adminDb.collection("questions").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (text) updates.text = text;
    if (options) updates.options = options;
    if (type) updates.type = type;
    if (correctOptionId) updates.correctOptionId = correctOptionId;
    if (correctOptionIds) updates.correctOptionIds = correctOptionIds;
    if (explanation !== undefined) updates.explanation = explanation;

    await ref.update(updates);
    return NextResponse.json({ success: true });
}

// DELETE — delete a question
export async function DELETE(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const doc = await adminDb.collection("questions").doc(id).get();
    if (!doc.exists) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const data = doc.data()!;
    const batch = adminDb.batch();

    batch.delete(doc.ref);

    // Update counts
    batch.update(adminDb.collection("quizzes").doc(data.quizId as string), {
        questionCount: FieldValue.increment(-1),
    });
    batch.update(adminDb.collection("subjects").doc(data.subjectId as string), {
        questionCount: FieldValue.increment(-1),
    });

    await batch.commit();
    return NextResponse.json({ success: true });
}
