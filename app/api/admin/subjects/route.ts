import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

// GET — list all subjects
export async function GET(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const snapshot = await adminDb.collection("subjects").get();
    const subjects = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json({ subjects });
}

// POST — create a new subject
export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { name, description } = body;
    if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const existing = await adminDb.collection("subjects").doc(id).get();
    if (existing.exists) {
        return NextResponse.json({ error: "Subject already exists" }, { status: 409 });
    }

    await adminDb.collection("subjects").doc(id).set({
        id,
        name,
        description: description || "",
        quizCount: 0,
        questionCount: 0,
        createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ subject: { id, name, description: description || "" } }, { status: 201 });
}

// PUT — update a subject
export async function PUT(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { id, name, description } = body;
    if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const ref = adminDb.collection("subjects").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
        return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    await ref.update(updates);
    return NextResponse.json({ success: true });
}

// DELETE — delete a subject and its quizzes/questions
export async function DELETE(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const batch = adminDb.batch();

    // Delete questions for this subject
    const questionsSnap = await adminDb.collection("questions").where("subjectId", "==", id).get();
    questionsSnap.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete quizzes for this subject
    const quizzesSnap = await adminDb.collection("quizzes").where("subjectId", "==", id).get();
    quizzesSnap.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete the subject
    batch.delete(adminDb.collection("subjects").doc(id));

    await batch.commit();
    return NextResponse.json({ success: true });
}
