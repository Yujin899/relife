import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const now = Timestamp.now();

        // Fetch all events (we filter by date in JS or simple query)
        // For a small number of events, fetching all is fine.
        const eventsSnap = await adminDb.collection("events")
            .orderBy("endDate", "desc")
            .limit(10)
            .get();

        if (eventsSnap.empty) {
            return NextResponse.json({ events: [] });
        }

        const events = eventsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch user progress for these events
        const progressSnap = await adminDb.collection("users").doc(uid).collection("event_progress").get();
        const progressMap = progressSnap.docs.reduce((acc: Record<string, { progress: number; claimed: boolean }>, doc) => {
            const data = doc.data();
            acc[doc.id] = {
                progress: data.progress || 0,
                claimed: data.claimed || false,
            };
            return acc;
        }, {});

        interface EventData {
            id: string;
            target: number;
            endDate: { toMillis: () => number };
            startDate: { toMillis: () => number };
            [key: string]: unknown;
        }

        const enrichedEvents = (events as unknown as EventData[]).map((event) => {
            const up = progressMap[event.id] || null;
            const status = event.endDate.toMillis() < now.toMillis()
                ? "past"
                : (event.startDate.toMillis() > now.toMillis() ? "upcoming" : "active");

            return {
                ...event,
                userProgress: up?.progress || 0,
                claimed: up?.claimed || false,
                completed: (up?.progress || 0) >= event.target,
                isJoined: !!up,
                status,
                // Raw timestamps for client countdowns
                serverTime: now.toMillis(),
                startTimestamp: event.startDate.toMillis(),
                endTimestamp: event.endDate.toMillis()
            };
        });

        return NextResponse.json({ events: enrichedEvents });
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error fetching events:", err);
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }
}
