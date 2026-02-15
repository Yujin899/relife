import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { generateMissingQuests } from "@/lib/quests";
import { FieldValue } from "firebase-admin/firestore";

interface QuestDoc {
    id: string;
    userId: string;
    templateId: string;
    type: string;
    description: string;
    trackingType: string;
    trackingMeta?: Record<string, string>;
    progress: number;
    target: number;
    completed: boolean;
    goldReward: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresAt?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignedAt?: any;
    [key: string]: unknown;
}

export async function GET(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const now = new Date();

        // 1. Fetch subjects from Firestore (for dynamic quest templates)
        const subjectsSnap = await adminDb.collection("subjects").get();
        const subjects = subjectsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
                id: data.id as string,
                name: data.name as string,
                quizCount: (data.quizCount as number) || 0,
            };
        });

        // 2. Fetch all quests for this user
        const snapshot = await adminDb
            .collection("quests")
            .where("userId", "==", uid)
            .get();

        // Filter non-expired in memory
        const existingQuests: QuestDoc[] = snapshot.docs
            .map((doc) => ({ ...doc.data(), id: doc.id } as QuestDoc))
            .filter((q) => {
                if (!q.expiresAt) return true;
                // Robust Date/Timestamp handling without relying on global Timestamp identifier
                let expDate: Date;
                if (typeof q.expiresAt.toDate === "function") {
                    expDate = q.expiresAt.toDate();
                } else if (q.expiresAt instanceof Date) {
                    expDate = q.expiresAt;
                } else {
                    expDate = new Date(q.expiresAt);
                }
                return expDate > now;
            });

        const activeDailyIds = existingQuests
            .filter((q) => q.type === "daily")
            .map((q) => q.templateId);

        const activeWeeklyIds = existingQuests
            .filter((q) => q.type === "weekly")
            .map((q) => q.templateId);

        // 3. Fetch user data for intelligence
        const userDoc = await adminDb.collection("users").doc(uid).get();
        const userData = userDoc.data() || {};
        const createdAt = userData.createdAt?.toDate() || new Date();
        const weeksJoined = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
        const clampedWeek = Math.min(12, weeksJoined);

        // Calculate mastery (accuracy)
        const totalCorrect = userData.totalCorrect || 0;
        const totalQuestions = userData.totalQuestions || 0;
        const masteryLevel = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

        // Fetch custom quest templates from Firestore
        const questTemplatesSnap = await adminDb.collection("quest_templates").get();
        const customTemplates = questTemplatesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch Roadmap templates for this week
        const roadmapSnap = await adminDb.collection("quest_roadmap")
            .where("week", "==", clampedWeek)
            .get();
        const roadmapTemplates = roadmapSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Intelligence: Identify neglected subjects
        // (Simple version: if a subject has 0 quizzes, it's neglected)
        const neglectedSubjectIds = subjects
            .filter(s => s.quizCount === 0)
            .map(s => s.id);

        // 4. Generate missing quests (with roadmap and intelligence)
        const newQuests = generateMissingQuests(
            activeDailyIds,
            activeWeeklyIds,
            uid,
            subjects,
            customTemplates,
            roadmapTemplates,
            { masteryLevel, neglectedSubjectIds }
        );

        if (newQuests.length > 0) {
            const batch = adminDb.batch();
            for (const quest of newQuests) {
                const ref = adminDb.collection("quests").doc();

                // Construct data without destructive stringification and avoid undefined trackingMeta
                const { trackingMeta, ...rest } = quest;
                const questData: Record<string, unknown> = {
                    ...rest,
                    id: ref.id,
                    assignedAt: FieldValue.serverTimestamp(),
                };

                if (trackingMeta) {
                    questData.trackingMeta = trackingMeta;
                }

                batch.set(ref, questData);

                // Add to existing quests with normalized timestamps
                existingQuests.push({
                    ...quest,
                    id: ref.id,
                    assignedAt: now, // approx
                    expiresAt: quest.expiresAt,
                } as QuestDoc);
            }
            await batch.commit();
        }

        // Final normalization for all quests before sending to client
        const normalizedQuests = existingQuests.map(q => {
            let expDate: Date;
            if (typeof q.expiresAt.toDate === "function") {
                expDate = q.expiresAt.toDate();
            } else if (q.expiresAt instanceof Date) {
                expDate = q.expiresAt;
            } else {
                expDate = new Date(q.expiresAt);
            }

            let assignedMillis: number;
            if (typeof q.assignedAt.toMillis === "function") {
                assignedMillis = q.assignedAt.toMillis();
            } else if (q.assignedAt instanceof Date) {
                assignedMillis = q.assignedAt.getTime();
            } else {
                assignedMillis = new Date(q.assignedAt).getTime();
            }

            return {
                ...q,
                expiresAt: expDate.getTime(),
                assignedAt: assignedMillis
            };
        });

        return NextResponse.json({ quests: normalizedQuests });
    } catch (error) {
        console.error("Error fetching quests:", error);
        return NextResponse.json({ error: "Failed to fetch quests" }, { status: 500 });
    }
}
