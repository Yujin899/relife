import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ attemptId: string }> }
) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { attemptId } = await params;

    try {
        const doc = await adminDb.collection("quiz_attempts").doc(attemptId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
        }

        const data = doc.data()!;

        // Ensure user can only see their own results
        if (data.userId !== uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json({ attempt: data });
    } catch (error) {
        console.error("Error fetching result:", error);
        return NextResponse.json({ error: "Failed to fetch result" }, { status: 500 });
    }
}
