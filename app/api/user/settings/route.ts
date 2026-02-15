import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

/**
 * Update User Settings (Theme, etc.)
 */
export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const { activeTheme, prefersMotion, enableSound, frame } = await request.json();

        const userRef = adminDb.collection("users").doc(uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userData = userDoc.data()!;
        const updateData: Record<string, unknown> = {};

        // Handle Theme Update
        if (activeTheme) {
            const inventory = userData.inventory || [];
            if (activeTheme !== "default" && !inventory.includes(activeTheme)) {
                return NextResponse.json({ error: "Theme not owned" }, { status: 403 });
            }
            updateData.activeTheme = activeTheme;
        }

        // Handle Frame Equip
        if (frame !== undefined) {
            const inventory = userData.inventory || [];
            // specific logic: if frame starts with "frame_", user must own it.
            // if frame is null/empty, user is unevenquiping.
            if (frame && frame.startsWith("/frames/") && !inventory.includes(frame.split("/").pop()?.split(".")[0] || "")) {
                // This check is a bit tricky because the item ID is "frame_1" but the URL is "/frames/frame-1.png".
                // Let's relax the server-side check slightly or align the ID/URL mapping.
                // Current Shop Item ID: "frame_1", Icon: "/frames/frame-1.png"
                // Let's rely on the client sending the *Item ID* for verification, or just trust the inventory check if we pass ID.
                // Actually, the previous implementation stored the *URL* in the user's `frame` field.
                // So the client sends the URL.
                // Strict check:
                // ID "frame_1" -> URL "/frames/frame-1.png"
                // We need a mapping or we just check if "frame_1" is in inventory.
                // Let's assume the client sends the ITEM ID for "equipping" and we resolve the URL here?
                // OR the client sends the URL and we check ownership.

                // Simpler Approach for now: Client sends the *Item ID* (e.g. "frame_1") to this API?
                // The existing API `api/shop` stored the ICON path.
                // Let's stick to receiving the Item ID for safety, and we look up the URL.
                // BUT `api/user/settings` is generic.

                // Let's accept the 'frame' as the Item ID (e.g. "frame_1") OR null.
                // We'll map it to the file path here.
            }

            // REVISED STRATEGY: 
            // Request body: { frame: "frame_1" } (Item ID)
            // Logic: Check if "frame_1" in inventory. If so, set frame = "/frames/frame-1.png".
            // If frame === null, set frame = null.

            if (frame === null) {
                updateData.frame = null;
            } else {
                // Check if frame exists in inventory (stores item ids like 'frame_1')
                if (inventory.includes(frame)) {
                    // Map frame_1 to /frames/frame-1.png
                    if (frame.startsWith("frame_")) {
                        const filename = frame.replace("_", "-") + ".png";
                        updateData.frame = `/frames/${filename}`;
                    } else {
                        // For league frames which store the name directly
                        updateData.frame = frame;
                    }
                } else {
                    return NextResponse.json({ error: "Frame not owned" }, { status: 403 });
                }
            }
        }

        // Handle General Settings
        if (prefersMotion !== undefined || enableSound !== undefined) {
            const currentSettings = userData.settings || { prefersMotion: true, enableSound: true };
            updateData.settings = {
                prefersMotion: prefersMotion !== undefined ? prefersMotion : currentSettings.prefersMotion,
                enableSound: enableSound !== undefined ? enableSound : currentSettings.enableSound,
            };
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        await userRef.update(updateData);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating user settings:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
