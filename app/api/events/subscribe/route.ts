import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const { eventId } = await request.json();
        if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

        // 1. Verify event exists and is not ended
        const eventRef = adminDb.collection("events").doc(eventId);
        const eventDoc = await eventRef.get();

        if (!eventDoc.exists) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventDoc.data()!;
        const now = Timestamp.now();

        if (event.endDate.toMillis() < now.toMillis()) {
            return NextResponse.json({ error: "Event has already ended" }, { status: 400 });
        }

        // 2. Create subscription
        const subRef = adminDb.collection("users").doc(uid).collection("event_subscriptions").doc(eventId);
        const subDoc = await subRef.get();

        if (subDoc.exists) {
            return NextResponse.json({ success: true, message: "Already subscribed" });
        }

        const batch = adminDb.batch();
        batch.set(subRef, {
            eventId,
            userId: uid,
            subscribedAt: FieldValue.serverTimestamp(),
        });

        // 3. Initialize progress document if it doesn't exist
        const progressRef = adminDb.collection("users").doc(uid).collection("event_progress").doc(eventId);
        batch.set(progressRef, {
            eventId,
            userId: uid,
            progress: 0,
            claimed: false,
            lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });

        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error subscribing to event:", err);
        return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }
}
