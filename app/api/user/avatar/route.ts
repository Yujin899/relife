import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { photoURL } = await request.json();

    if (!photoURL || typeof photoURL !== "string") {
        return NextResponse.json({ error: "Invalid photoURL" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(authResult.uid);

    try {
        await adminDb.runTransaction(async (t) => {
            const doc = await t.get(userRef);
            if (!doc.exists) throw "User not found";

            const data = doc.data()!;
            const availableUpdates = data.profileUpdates || 0;

            if (availableUpdates <= 0) {
                throw "No profile updates available. Purchase more in the shop.";
            }

            // Decrement count and set photoURL
            t.update(userRef, {
                profileUpdates: FieldValue.increment(-1),
                photoURL: photoURL
            });
        });

        // Also update Auth profile for faster client-side access
        await adminAuth.updateUser(authResult.uid, {
            photoURL: photoURL
        });

        return NextResponse.json({ success: true, message: "Avatar updated successfully" });

    } catch (error) {
        console.error("Avatar update failed:", error);
        return NextResponse.json({
            error: typeof error === "string" ? error : "Failed to update avatar"
        }, { status: 400 });
    }
}
