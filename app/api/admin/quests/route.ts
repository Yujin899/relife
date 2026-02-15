import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

// GET — list all global quest templates
export async function GET(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const snapshot = await adminDb.collection("quest_templates").orderBy("type").get();
        const quests = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
        return NextResponse.json({ quests });
    } catch (error) {
        console.error("Error fetching quest templates:", error);
        return NextResponse.json({ error: "Failed to fetch quests" }, { status: 500 });
    }
}

// POST — create or update a quest template
export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const body = await request.json();
        const { id, description, type, trackingType, target, goldReward, trackingMeta } = body;

        if (!description || !type || !trackingType || !target || !goldReward) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const templateId = id || `custom_${Date.now()}`;
        const templateData = {
            id: templateId,
            description,
            type,
            trackingType,
            target: Number(target),
            goldReward: Number(goldReward),
            trackingMeta: trackingMeta || {},
            updatedAt: FieldValue.serverTimestamp(),
        };

        await adminDb.collection("quest_templates").doc(templateId).set(templateData, { merge: true });

        return NextResponse.json({ success: true, template: templateData });
    } catch (error) {
        console.error("Error saving quest template:", error);
        return NextResponse.json({ error: "Failed to save quest template" }, { status: 500 });
    }
}

// DELETE — remove a quest template
export async function DELETE(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await adminDb.collection("quest_templates").doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting quest template:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
