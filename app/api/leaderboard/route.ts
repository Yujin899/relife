import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

interface LeaderboardEntry {
    uid: string;
    displayName: string;
    totalGold: number;
    photoURL?: string;
    frame?: string;
}

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "all"; // all, weekly, subject
    const subjectId = searchParams.get("subjectId");

    try {
        let leaderboard: LeaderboardEntry[] = [];
        let userGold = 0;
        let userRank = 0;

        if (tab === "all") {
            // All-time: Sort by totalGold in users collection
            const snapshot = await adminDb.collection("users").get();
            const allUsers = snapshot.docs
                .map((doc) => doc.data())
                .sort((a, b) => (b.totalGold || 0) - (a.totalGold || 0));

            // Filter for public view but calculate rank from full list
            const publicLeaderboard = allUsers.filter(u => u.settings?.isPrivate !== true || u.uid === uid);

            leaderboard = publicLeaderboard.slice(0, 50).map((data) => ({
                rank: allUsers.findIndex(u => u.uid === data.uid) + 1,
                uid: data.uid,
                displayName: (data.settings?.isPrivate === true && data.uid !== uid) ? "Private Student" : (data.displayName || "Student"),
                totalGold: data.totalGold || 0,
                isCurrentUser: data.uid === uid,
                photoURL: (data.settings?.isPrivate === true && data.uid !== uid) ? undefined : data.photoURL,
                frame: (data.settings?.isPrivate === true && data.uid !== uid) ? undefined : data.frame
            }));

            const userDoc = await adminDb.collection("users").doc(uid).get();
            userGold = userDoc.exists ? userDoc.data()!.totalGold || 0 : 0;
            userRank = allUsers.findIndex((u) => u.uid === uid) + 1;
        } else {
            // Weekly or Subject: Aggregate from quiz_attempts
            let query: FirebaseFirestore.Query = adminDb.collection("quiz_attempts");

            if (tab === "weekly") {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                query = query.where("completedAt", ">=", weekAgo);
            } else if (tab === "subject" && subjectId) {
                query = query.where("subjectId", "==", subjectId);
            }

            const attemptsSnap = await query.get();
            const userAggregates: Record<string, { uid: string; gold: number }> = {};

            attemptsSnap.docs.forEach((doc) => {
                const data = doc.data();
                const userId = data.userId;
                const gold = data.goldEarned || 0;

                if (!userAggregates[userId]) {
                    userAggregates[userId] = { uid: userId, gold: 0 };
                }
                userAggregates[userId].gold += gold;
            });

            const sortedAggregates = Object.values(userAggregates)
                .sort((a, b) => b.gold - a.gold);

            // Fetch display names and privacy settings for the top 50
            const top50 = sortedAggregates.slice(0, 50);
            const userIds = top50.map((u) => u.uid);

            const usersSnap = await adminDb.collection("users").where("uid", "in", userIds.length > 0 ? userIds : ["dummy"]).get();
            const userMap: Record<string, { name: string; isPrivate: boolean; photoURL?: string; frame?: string }> = {};
            usersSnap.docs.forEach((d) => {
                const uData = d.data();
                userMap[uData.uid] = {
                    name: uData.displayName || "Student",
                    isPrivate: uData.settings?.isPrivate === true,
                    photoURL: uData.photoURL,
                    frame: uData.frame
                };
            });

            leaderboard = top50
                .filter(u => !userMap[u.uid]?.isPrivate || u.uid === uid)
                .map((data) => ({
                    rank: sortedAggregates.findIndex(u => u.uid === data.uid) + 1,
                    uid: data.uid,
                    displayName: (userMap[data.uid]?.isPrivate && data.uid !== uid) ? "Private Student" : (userMap[data.uid]?.name || "Student"),
                    totalGold: data.gold,
                    isCurrentUser: data.uid === uid,
                    photoURL: (userMap[data.uid]?.isPrivate && data.uid !== uid) ? undefined : userMap[data.uid]?.photoURL,
                    frame: (userMap[data.uid]?.isPrivate && data.uid !== uid) ? undefined : userMap[data.uid]?.frame
                }));

            userGold = userAggregates[uid]?.gold || 0;
            userRank = sortedAggregates.findIndex((u) => u.uid === uid) + 1;
        }

        return NextResponse.json({
            leaderboard,
            userRank: userRank || 0,
            userGold,
        });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
