import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { getLeague } from "@/lib/leagues";

import { adminRtdb } from "@/lib/firebase-admin";

interface Message {
    id: string;
    uid: string;
    displayName: string;
    league: string;
    content: string;
    type: string;
    createdAt: number;
    isEdited?: boolean;
    updatedAt?: number;
    replyTo?: string | null;
    replyToUser?: string | null;
    replyToContent?: string | null;
    replyToUid?: string | null;
}

const COOLDOWNS: Record<string, number> = {
    "Bronze": 300000, // 5 mins
    "Silver": 120000, // 2 mins
    "Gold": 5000,    // 5 secs (basically free)
    "Platinum": 0,
    "Diamond": 0
};

export async function GET(request: NextRequest) {
    // GET remains for initial legacy support or pre-fetching, 
    // but the UI will transition to RTDB Listeners.
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId") || "general";

    try {
        const snapshot = await adminRtdb.ref(`chat_messages/${channelId}`)
            .limitToLast(50)
            .get();

        const messages = snapshot.exists()
            ? (() => {
                const data = snapshot.val() as Record<string, Omit<Message, 'id'>>;
                const msgs = Object.entries(data).map(([id, val]) => ({
                    id,
                    ...val
                }));
                return msgs;
            })()
            : [];

        return NextResponse.json({ messages });
    } catch (error) {
        console.error("Error fetching chat:", error);
        return NextResponse.json({ error: "Failed to fetch chat" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const body = await request.json();
        const { channelId, content, messageId, replyTo, replyToUser, replyToContent, replyToUid } = body;

        if (!content || content.length > 200) {
            return NextResponse.json({ error: "Invalid content length" }, { status: 400 });
        }

        if (!messageId) {
            return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
        }

        // Fetch user rank and lastChatAt from Firestore (User profiles stay in Firestore)
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const userData = userDoc.data()!;
        const league = getLeague(userData.totalGold || 0);
        const lastChatAt = userData.lastChatAt?.toDate() || new Date(0);
        const now = new Date();

        // Enforce Cooldown (Bypassed for General)
        const cooldown = (channelId === "general" || !channelId) ? 0 : (COOLDOWNS[league.name] || 300000);
        if (now.getTime() - lastChatAt.getTime() < cooldown) {
            const remaining = Math.ceil((cooldown - (now.getTime() - lastChatAt.getTime())) / 1000);
            return NextResponse.json({ error: `Cooldown active. Wait ${remaining}s.` }, { status: 429 });
        }

        // Channel Permission Check
        const hierarchy = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
        const userLeagueIndex = hierarchy.indexOf(league.name);

        if (channelId && channelId.startsWith("league_")) {
            const targetLeague = channelId.split("_")[1]; // e.g., 'gold'
            const formattedTarget = targetLeague.charAt(0).toUpperCase() + targetLeague.slice(1);
            const targetLeagueIndex = hierarchy.indexOf(formattedTarget);

            if (userLeagueIndex < targetLeagueIndex && !["Platinum", "Diamond"].includes(league.name)) {
                return NextResponse.json({ error: `${formattedTarget} rank required for this club.` }, { status: 403 });
            }
        }

        // Create Message in RTDB using Deterministic ID
        const targetChannel = channelId || "general";
        const messageRef = adminRtdb.ref(`chat_messages/${targetChannel}`).child(messageId);

        console.log(`[Chat API] Incoming Request Body:`, JSON.stringify(body, null, 2));

        const message = {
            id: messageId,
            uid,
            displayName: userData.displayName || "Student",
            league: league.name,
            photoURL: userData.photoURL || null,
            frame: userData.frame || null,
            content: content.trim(),
            type: "text",
            createdAt: Date.now(),
            replyTo: replyTo || null,
            replyToUser: replyToUser || null,
            replyToContent: replyToContent || null,
            replyToUid: replyToUid || null
        };

        await messageRef.set(message);

        // Update lastChatAt in Firestore
        await adminDb.collection("users").doc(uid).update({
            lastChatAt: new Date()
        });

        return NextResponse.json({ success: true, message });
    } catch (error) {
        console.error("Error posting chat:", error);
        return NextResponse.json({ error: "Failed to post chat" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId") || "general";
    const messageId = searchParams.get("messageId");

    if (!messageId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });

    try {
        const body = await request.json();
        const { content } = body;

        if (!content || content.length > 200) {
            return NextResponse.json({ error: "Invalid content length" }, { status: 400 });
        }

        const messageRef = adminRtdb.ref(`chat_messages/${channelId}/${messageId}`);
        const snapshot = await messageRef.get();

        if (!snapshot.exists()) return NextResponse.json({ error: "Message not found" }, { status: 404 });
        if (snapshot.val().uid !== uid) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        await messageRef.update({
            content: content.trim(),
            isEdited: true,
            updatedAt: Date.now()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error editing chat:", error);
        return NextResponse.json({ error: "Failed to edit chat" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId") || "general";
    const messageId = searchParams.get("messageId");

    if (!messageId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });

    try {
        const messageRef = adminRtdb.ref(`chat_messages/${channelId}/${messageId}`);
        const snapshot = await messageRef.get();

        if (!snapshot.exists()) return NextResponse.json({ success: true });
        if (snapshot.val().uid !== uid) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

        await messageRef.remove();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting chat:", error);
        return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
    }
}
