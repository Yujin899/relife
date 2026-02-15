import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";
import { Timestamp } from "firebase-admin/firestore";

// POST — create or edit an event
export async function POST(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const body = await request.json();
        const { id, title, description, icon, target, startDate, endDate } = body;

        if (!title || !description || !icon || !target || !startDate || !endDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const eventId = id || `event_${Date.now()}`;
        const eventData = {
            id: eventId,
            title,
            description,
            icon,
            target: Number(target),
            startDate: Timestamp.fromMillis(new Date(startDate).getTime()),
            endDate: Timestamp.fromMillis(new Date(endDate).getTime()),
            updatedAt: Timestamp.now(),
        };

        await adminDb.collection("events").doc(eventId).set(eventData, { merge: true });

        return NextResponse.json({ success: true, event: eventData });
    } catch (error) {
        console.error("Error saving event:", error);
        return NextResponse.json({ error: "Failed to save event" }, { status: 500 });
    }
}

// DELETE — remove an event
export async function DELETE(request: NextRequest) {
    const authResult = await verifyAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "ID is required" }, { status: 400 });
        }

        await adminDb.collection("events").doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting event:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
