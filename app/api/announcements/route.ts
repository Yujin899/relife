import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { getLeague } from "@/lib/leagues";

const TEMPLATES: Record<string, string> = {
    "study_focus": "Join me in focusing on {subject}!",
    "event_boost": "Don't miss the ongoing event: {event}!",
    "league_cheer": "Keep pushing, {league} league! We can do it.",
    "rank_motivate": "Study hard. The top rank is within reach."
};

export async function GET() {
    try {
        const snapshot = await adminDb.collection("announcements")
            .where("expiresAt", ">", new Date())
            .orderBy("expiresAt", "asc")
            .limit(1)
            .get();

        if (snapshot.empty) return NextResponse.json({ announcement: null });

        const data = snapshot.docs[0].data();
        return NextResponse.json({
            announcement: {
                id: snapshot.docs[0].id,
                ...data,
                expiresAt: data.expiresAt.toDate()
            }
        });
    } catch (error) {
        console.error("Error fetching announcement:", error);
        return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const body = await request.json();
        const { templateId, variables } = body;

        if (!TEMPLATES[templateId]) {
            return NextResponse.json({ error: "Invalid template" }, { status: 400 });
        }

        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const userData = userDoc.data()!;
        const league = getLeague(userData.totalGold || 0);

        if (!["Platinum", "Diamond"].includes(league.name)) {
            return NextResponse.json({ error: "Platinum rank or higher required." }, { status: 403 });
        }

        // Check Weekly Quota (2 per week)
        const weeklyQuota = 2;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recentAnnouncements = await adminDb.collection("announcements")
            .where("authorUid", "==", uid)
            .where("createdAt", ">", weekAgo)
            .get();

        if (recentAnnouncements.size >= weeklyQuota) {
            return NextResponse.json({ error: "Weekly quota reached (2 per week)." }, { status: 429 });
        }

        // Construct Message
        let content = TEMPLATES[templateId];
        if (variables) {
            Object.entries(variables).forEach(([key, val]) => {
                content = content.replace(`{${key}}`, String(val));
            });
        }

        const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hour duration

        const announcement = {
            type: "broadcast",
            authorUid: uid,
            authorName: userData.displayName || "Elite Student",
            authorLeague: league.name,
            content,
            createdAt: now,
            expiresAt
        };

        const docRef = await adminDb.collection("announcements").add(announcement);

        return NextResponse.json({
            success: true,
            announcement: { id: docRef.id, ...announcement }
        });
    } catch (error) {
        console.error("Error posting announcement:", error);
        return NextResponse.json({ error: "Failed to post announcement" }, { status: 500 });
    }
}
