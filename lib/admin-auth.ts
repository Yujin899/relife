import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "./auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin emails are stored in an env variable.
 * Comma-separated list: ADMIN_EMAILS=user1@mail.com,user2@mail.com
 * If not set, falls back to checking a Firestore `admins` collection.
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function verifyAdmin(request: NextRequest): Promise<
    { uid: string; email: string; role: string } | NextResponse
> {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { uid } = authResult;

    // Get user data from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const email = (userData.email as string || "").toLowerCase();
    const role = userData.role as string || "student";

    // 1. Check for 'owner' or 'admin' role directly
    if (role === "owner" || role === "admin") {
        return { uid, email, role };
    }

    // 2. Secondary check: env-based whitelist (always grants owner-level context here)
    if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)) {
        return { uid, email, role: "owner" };
    }

    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}
