import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const { eventId } = await request.json();
        if (!eventId) return NextResponse.json({ error: "eventId is required" }, { status: 400 });

        const eventRef = adminDb.collection("events").doc(eventId);
        const eventDoc = await eventRef.get();

        if (!eventDoc.exists) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventDoc.data()!;
        const progressRef = adminDb.collection("users").doc(uid).collection("event_progress").doc(eventId);
        const progressDoc = await progressRef.get();

        if (!progressDoc.exists) {
            return NextResponse.json({ error: "No progress found for this event" }, { status: 400 });
        }

        const progress = progressDoc.data()!;
        if (progress.claimed) {
            return NextResponse.json({ error: "Reward already claimed" }, { status: 400 });
        }

        if (progress.progress < event.target) {
            return NextResponse.json({ error: "Goal not reached yet" }, { status: 400 });
        }

        // Atomic claim
        const batch = adminDb.batch();
        const userRef = adminDb.collection("users").doc(uid);

        // 1. Mark as claimed
        batch.update(progressRef, {
            claimed: true,
            claimedAt: FieldValue.serverTimestamp()
        });

        // 2. Award Gold
        batch.update(userRef, {
            totalGold: FieldValue.increment(event.rewards.gold)
        });

        // 3. Award Badge if applicable
        if (event.rewards.badgeId) {
            const badgeRef = adminDb.collection("user_badges").doc();
            batch.set(badgeRef, {
                userId: uid,
                badgeId: event.rewards.badgeId,
                name: event.title + " Participant",
                earnedAt: FieldValue.serverTimestamp(),
                isEventBadge: true
            });
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            rewardGold: event.rewards.gold,
            badgeId: event.rewards.badgeId
        });

    } catch (error: any) {
        console.error("Error claiming event reward:", error);
        return NextResponse.json({ error: "Failed to claim reward" }, { status: 500 });
    }
}
