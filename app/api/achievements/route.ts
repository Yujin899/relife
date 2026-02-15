import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { BADGES } from "@/lib/achievements";

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        // Get user's earned badges
        const badgesSnap = await adminDb
            .collection("user_badges")
            .where("userId", "==", uid)
            .get();

        const earnedIds = badgesSnap.docs.map((doc) => doc.data().badgeId as string);

        // Map all badges with earned status
        const badges = BADGES.map((badge) => ({
            id: badge.id,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            category: badge.category,
            earned: earnedIds.includes(badge.id),
            earnedAt: badgesSnap.docs.find((d) => d.data().badgeId === badge.id)?.data().earnedAt || null,
        }));

        return NextResponse.json({
            badges,
            totalEarned: earnedIds.length,
            totalBadges: BADGES.length,
        });
    } catch (error) {
        console.error("Error fetching achievements:", error);
        return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
    }
}
