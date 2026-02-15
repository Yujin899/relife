import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

// GET — list quizzes (optionally filtered by subjectId)
export async function GET(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");

    let query: FirebaseFirestore.Query = adminDb.collection("quizzes");
    if (subjectId) {
        query = query.where("subjectId", "==", subjectId);
    }

    const snapshot = await query.get();
    const quizzes = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json({ quizzes });
}

// POST — create a new quiz
export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { subjectId, title, description } = body;
    if (!subjectId || !title) {
        return NextResponse.json({ error: "subjectId and title are required" }, { status: 400 });
    }

    // Verify subject exists
    const subjectDoc = await adminDb.collection("subjects").doc(subjectId).get();
    if (!subjectDoc.exists) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const quizId = `${subjectId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

    await adminDb.collection("quizzes").doc(quizId).set({
        quizId,
        subjectId,
        title,
        description: description || "",
        questionCount: 0,
        createdAt: FieldValue.serverTimestamp(),
    });

    // Update subject quiz count
    await adminDb.collection("subjects").doc(subjectId).update({
        quizCount: FieldValue.increment(1),
    });

    return NextResponse.json({ quiz: { quizId, subjectId, title } }, { status: 201 });
}

// PUT — update a quiz
export async function PUT(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { quizId, title, description } = body;
    if (!quizId) {
        return NextResponse.json({ error: "quizId is required" }, { status: 400 });
    }

    const ref = adminDb.collection("quizzes").doc(quizId);
    const doc = await ref.get();
    if (!doc.exists) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;

    await ref.update(updates);
    return NextResponse.json({ success: true });
}

// DELETE — delete a quiz and its questions
export async function DELETE(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");
    if (!quizId) {
        return NextResponse.json({ error: "quizId is required" }, { status: 400 });
    }

    const quizDoc = await adminDb.collection("quizzes").doc(quizId).get();
    if (!quizDoc.exists) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const subjectId = quizDoc.data()!.subjectId as string;
    const batch = adminDb.batch();

    // Delete questions for this quiz
    const questionsSnap = await adminDb.collection("questions").where("quizId", "==", quizId).get();
    questionsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete the quiz
    batch.delete(adminDb.collection("quizzes").doc(quizId));

    // Update subject counts
    batch.update(adminDb.collection("subjects").doc(subjectId), {
        quizCount: FieldValue.increment(-1),
        questionCount: FieldValue.increment(-questionsSnap.size),
    });

    await batch.commit();
    return NextResponse.json({ success: true });
}
