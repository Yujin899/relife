import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the decoded UID on success, or a NextResponse error on failure.
 */
export async function verifyAuth(
    request: NextRequest
): Promise<{ uid: string } | NextResponse> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { uid: decoded.uid };
    } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
}
