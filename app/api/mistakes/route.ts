import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");

    try {
        // Simple query — filter by userId only (avoids needing composite index)
        let query: FirebaseFirestore.Query = adminDb
            .collection("mistakes")
            .where("userId", "==", uid);

        if (subjectId) {
            query = query.where("subjectId", "==", subjectId);
        }

        const snapshot = await query.get();

        // Sort client-side to avoid composite index requirement
        const mistakes = snapshot.docs
            .map((doc) => doc.data())
            .sort((a, b) => {
                const aTime = a.occurredAt?.toMillis?.() || 0;
                const bTime = b.occurredAt?.toMillis?.() || 0;
                return bTime - aTime;
            })
            .slice(0, 50);

        // If no subjectId filter, also return aggregate counts per subject
        let subjectCounts: Record<string, number> | undefined;
        if (!subjectId) {
            subjectCounts = {};
            for (const m of mistakes) {
                const sid = m.subjectId as string;
                subjectCounts[sid] = (subjectCounts[sid] || 0) + 1;
            }
        }

        return NextResponse.json({ mistakes, subjectCounts });
    } catch (error) {
        console.error("Error fetching mistakes:", error);
        return NextResponse.json({ error: "Failed to fetch mistakes" }, { status: 500 });
    }
}
