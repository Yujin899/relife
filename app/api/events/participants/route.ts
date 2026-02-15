import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
        return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    try {
        // Fetch top participants using a collection group query on 'event_progress'
        // This requires a Firestore Index for the 'eventId' and 'progress' fields.
        const snapshot = await adminDb.collectionGroup("event_progress")
            .where("eventId", "==", eventId)
            .orderBy("progress", "desc")
            .orderBy("lastUpdated", "asc") // Tie-breaker: earlier sub/activity
            .limit(50)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ participants: [] });
        }

        // We need user names and leagues. Let's fetch them in a batch.
        const participantData = snapshot.docs.map(doc => doc.data());
        const userIds = participantData.map(p => p.userId);

        // Batch fetch users (max 30 per 'in' query, we'll do 50 so 2 chunks)
        const participants = [];
        for (let i = 0; i < userIds.length; i += 30) {
            const chunk = userIds.slice(i, i + 30);
            const usersSnap = await adminDb.collection("users")
                .where("__name__", "in", chunk)
                .get();

            const userMap = usersSnap.docs.reduce((acc: Record<string, { displayName?: string; totalGold?: number; leagueBadge?: string }>, d) => {
                acc[d.id] = d.data();
                return acc;
            }, {});

            for (const p of participantData.filter(pd => chunk.includes(pd.userId))) {
                const userData = userMap[p.userId] || {};
                participants.push({
                    userId: p.userId,
                    displayName: userData.displayName || "Student",
                    totalGold: userData.totalGold || 0,
                    progress: p.progress,
                    // League info is derived from totalGold in Relife
                    leagueBadge: userData.leagueBadge || "Bronze",
                });
            }
        }

        return NextResponse.json({ participants });
    } catch (error: unknown) {
        console.error("Error fetching participants:", error);
        const err = error as { code?: number; message?: string };
        if (err.code === 9) { // FAILED_PRECONDITION (missing index)
            return NextResponse.json({
                error: "Participants board requires a Firestore Index.",
                indexUrl: err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0]
            }, { status: 412 });
        }
        return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
    }
}
