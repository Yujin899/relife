import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const { displayName, photoURL } = await request.json();

        const updates: Record<string, unknown> = {};
        if (displayName) updates.displayName = displayName;
        if (photoURL) updates.photoURL = photoURL;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No updates provided" }, { status: 400 });
        }

        // Update Firestore
        await adminDb.collection("users").doc(uid).update(updates);

        // Update Firebase Auth if needed (for consistency)
        if (displayName || photoURL) {
            await adminAuth.updateUser(uid, {
                displayName: displayName || undefined,
                photoURL: photoURL || undefined,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
