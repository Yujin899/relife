import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
    try {
        const snapshot = await adminDb.collection("subjects").get();
        const subjects = snapshot.docs.map((doc) => doc.data());
        return NextResponse.json({ subjects });
    } catch (error) {
        console.error("Error fetching subjects:", error);
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}
