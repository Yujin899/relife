import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth } from "@/lib/auth";
import { calculateGold, getTodayAndYesterday } from "@/lib/gold";
import { computeQuestUpdates, type TrackingType } from "@/lib/quests";
import { checkNewBadges, type UserStats } from "@/lib/achievements";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { calculateNextReview } from "@/lib/sr";

export async function POST(request: NextRequest) {
    const authResult = await verifyAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    try {
        const body = await request.json();
        const { quizId, answers } = body as {
            quizId: string;
            answers: { questionId: string; selectedOptionId: string }[];
        };

        if (!quizId || !answers || !Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        // 1. Fetch correct answers for submitted questions
        const questionsSnap = await adminDb
            .collection("questions")
            .where("quizId", "==", quizId)
            .get();

        const subjectId = questionsSnap.docs[0]?.data().subjectId || "";

        const questionsMap = new Map<string, {
            correctOptionId?: string;
            correctOptionIds?: string[];
            text: string;
            options: { id: string; text: string }[];
            type: "single" | "multi";
            explanation?: string;
        }>();

        questionsSnap.docs.forEach((doc) => {
            const data = doc.data();
            questionsMap.set(data.id, {
                correctOptionId: data.correctOptionId,
                correctOptionIds: data.correctOptionIds,
                text: data.text,
                options: data.options,
                type: data.type || (data.correctOptionIds ? "multi" : "single"),
                explanation: data.explanation || "",
            });
        });

        // Validate all submitted questionIds exist
        for (const a of answers) {
            if (!questionsMap.has(a.questionId)) {
                return NextResponse.json(
                    { error: `Question ${a.questionId} not found` },
                    { status: 400 }
                );
            }
        }

        // 2. Score
        let score = 0;
        const mistakes: {
            questionId: string;
            userAnswer: string;
            correctAnswer: string;
            questionText: string;
            options: { id: string; text: string }[];
            explanation: string;
        }[] = [];

        for (const a of answers) {
            const q = questionsMap.get(a.questionId)!;
            const isMulti = q.type === "multi";

            let isCorrect = false;

            if (isMulti) {
                const userAnswers = Array.isArray(a.selectedOptionId) ? [...a.selectedOptionId].sort() : [a.selectedOptionId].sort();
                const correctAnswers = [...(q.correctOptionIds || [])].sort();
                isCorrect = JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
            } else {
                isCorrect = a.selectedOptionId === q.correctOptionId;
            }

            if (isCorrect) {
                score++;
            } else {
                mistakes.push({
                    questionId: a.questionId,
                    userAnswer: Array.isArray(a.selectedOptionId) ? a.selectedOptionId.join(",") : a.selectedOptionId,
                    correctAnswer: isMulti ? (q.correctOptionIds || []).join(",") : (q.correctOptionId || ""),
                    questionText: q.text,
                    options: q.options,
                    explanation: q.explanation || "",
                });
            }
        }

        const totalQuestions = answers.length;

        // 3. Get user doc for Gold calculation
        const userRef = adminDb.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const userData = userSnap.data()!;

        // 4. Calculate Gold
        const { today, yesterday } = getTodayAndYesterday();
        const goldResult = calculateGold({
            score,
            totalQuestions,
            lastQuizDate: userData.lastQuizDate || null,
            currentStreak: userData.currentStreak || 0,
            today,
            yesterday,
        });

        // 5. Batch write everything
        const batch = adminDb.batch();

        // a. Create quiz attempt
        const attemptRef = adminDb.collection("quiz_attempts").doc();
        batch.set(attemptRef, {
            id: attemptRef.id,
            userId: uid,
            quizId,
            subjectId,
            score,
            totalQuestions,
            goldEarned: goldResult.total,
            goldBreakdown: {
                base: goldResult.base,
                perfectBonus: goldResult.perfectBonus,
                dailyBonus: goldResult.dailyBonus,
                streakBonus: goldResult.streakBonus,
            },
            completedAt: FieldValue.serverTimestamp(),
        });

        // b. Create mistake docs
        for (const m of mistakes) {
            const mistakeRef = adminDb.collection("mistakes").doc();
            batch.set(mistakeRef, {
                id: mistakeRef.id,
                userId: uid,
                subjectId,
                questionId: m.questionId,
                quizAttemptId: attemptRef.id,
                userAnswer: m.userAnswer,
                correctAnswer: m.correctAnswer,
                questionText: m.questionText,
                options: m.options,
                explanation: m.explanation,
                occurredAt: FieldValue.serverTimestamp(),
            });

            // ─── Phase 3: Spaced Repetition ──────────────────────────
            // Reset question to Box 1 for review tomorrow
            const studyProgressId = `${uid}_${subjectId}_${m.questionId}`;
            const studyRef = adminDb.collection("study_progress").doc(studyProgressId);
            batch.set(studyRef, {
                userId: uid,
                subjectId,
                questionId: m.questionId,
                box: 1,
                nextReview: Timestamp.fromDate(calculateNextReview(1)),
                lastMistakeAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        // c. Update user doc
        batch.update(userRef, {
            totalGold: FieldValue.increment(goldResult.total),
            totalQuizzes: FieldValue.increment(1),
            totalCorrect: FieldValue.increment(score),
            totalQuestions: FieldValue.increment(totalQuestions),
            currentStreak: goldResult.newStreak,
            longestStreak: Math.max(userData.longestStreak || 0, goldResult.newStreak),
            lastQuizDate: today,
        });

        // ──────────────────────────────────────────────────────────
        // 6. AUTO-UPDATE QUEST PROGRESS
        // ──────────────────────────────────────────────────────────
        const now = new Date();
        const questsSnap = await adminDb
            .collection("quests")
            .where("userId", "==", uid)
            .get();

        // Filter to active (non-expired, non-completed) quests
        const activeQuests = questsSnap.docs
            .map((doc) => ({
                id: doc.id,
                trackingType: doc.data().trackingType as TrackingType,
                trackingMeta: doc.data().trackingMeta as Record<string, string> | undefined,
                progress: (doc.data().progress as number) || 0,
                target: (doc.data().target as number) || 1,
                completed: (doc.data().completed as boolean) || false,
                goldReward: (doc.data().goldReward as number) || 0,
                subjectsToday: (doc.data().subjectsToday as string[]) || [],
                expiresAt: doc.data().expiresAt?.toDate?.() as Date | undefined,
            }))
            .filter((q) => !q.completed && q.expiresAt && q.expiresAt > now);

        // Compute what progress updates to make
        const questUpdates = computeQuestUpdates(activeQuests, {
            score,
            totalQuestions,
            goldEarned: goldResult.total,
            subjectId,
            newStreak: goldResult.newStreak,
        });

        let questGoldBonus = 0;
        for (const update of questUpdates) {
            const questRef = adminDb.collection("quests").doc(update.questId);
            const questData: Record<string, unknown> = {
                progress: update.newProgress,
                completed: update.completed,
            };

            // For "different_subjects" tracking, store which subjects were counted
            const quest = activeQuests.find((q) => q.id === update.questId);
            if (quest?.trackingType === "different_subjects") {
                const subjects = quest.subjectsToday || [];
                if (!subjects.includes(subjectId)) {
                    questData.subjectsToday = [...subjects, subjectId];
                }
            }

            if (update.completed) {
                questData.completedAt = FieldValue.serverTimestamp();
                questGoldBonus += update.goldReward;
            }

            batch.update(questRef, questData);
        }

        // Add quest gold rewards to user
        if (questGoldBonus > 0) {
            batch.update(userRef, {
                totalGold: FieldValue.increment(questGoldBonus),
                completedQuests: FieldValue.increment(
                    questUpdates.filter((u) => u.completed).length
                ),
            });
        }

        await batch.commit();

        // ──────────────────────────────────────────────────────────
        // 6.5. PHASE 4: EVENT PROGRESS TRACKING
        // ──────────────────────────────────────────────────────────
        try {
            const now = new Date();
            const activeEventsSnap = await adminDb.collection("events")
                .where("startDate", "<=", Timestamp.fromDate(now))
                .where("endDate", ">=", Timestamp.fromDate(now))
                .get();

            if (!activeEventsSnap.empty) {
                const eventBatch = adminDb.batch();
                // Get subject data once if any event needs it
                let subData: any = null;

                for (const eventDoc of activeEventsSnap.docs) {
                    const event = eventDoc.data();
                    const eventId = eventDoc.id;

                    // Check if user is joined (has a progress doc)
                    const progressRef = adminDb.collection("users").doc(uid).collection("event_progress").doc(eventId);
                    const progressDoc = await progressRef.get();
                    if (!progressDoc.exists) continue;

                    let match = false;

                    if (event.type === "volume") {
                        if (event.conditions?.isScience) {
                            if (!subData) {
                                const s = await adminDb.collection("subjects").doc(subjectId).get();
                                subData = s.exists ? s.data() : {};
                            }
                            if (subData?.category === "Science") match = true;
                        } else if (!event.conditions?.subjectId || event.conditions.subjectId === subjectId) {
                            match = true;
                        }
                    } else if (event.type === "precision") {
                        const isPerfect = score === totalQuestions;
                        if (isPerfect) match = true;
                    } else if (event.type === "gold") {
                        // For gold events, we might increment by amount or just by "any gold earned"
                        // Design says "Complete X quizzes", so let's stick to simple counts for now
                        match = true;
                    }

                    if (match) {
                        eventBatch.update(progressRef, {
                            progress: FieldValue.increment(1),
                            lastUpdated: FieldValue.serverTimestamp(),
                        });
                    }
                }
                await eventBatch.commit();
            }
        } catch (eventError) {
            console.error("Error tracking event progress:", eventError);
            // Don't fail the main request if event tracking fails
        }

        // ──────────────────────────────────────────────────────────
        // 7. CHECK FOR NEW ACHIEVEMENTS
        // ──────────────────────────────────────────────────────────
        const isPerfect = score === totalQuestions;
        const updatedTotalGold = (userData.totalGold || 0) + goldResult.total + questGoldBonus;
        const updatedQuizzes = (userData.totalQuizzes || 0) + 1;
        const updatedCorrect = (userData.totalCorrect || 0) + score;
        const updatedPerfect = (userData.perfectScores || 0) + (isPerfect ? 1 : 0);
        const updatedQuests = (userData.completedQuests || 0) + questUpdates.filter((u) => u.completed).length;

        // Count distinct subjects the user has studied
        const attemptsSnap = await adminDb
            .collection("quiz_attempts")
            .where("userId", "==", uid)
            .get();
        const subjectsStudied = new Set(attemptsSnap.docs.map((d) => d.data().subjectId)).size;
        const totalSubjectsSnap = await adminDb.collection("subjects").get();

        const stats: UserStats = {
            totalQuizzes: updatedQuizzes,
            totalCorrect: updatedCorrect,
            totalQuestions: (userData.totalQuestions || 0) + totalQuestions,
            totalGold: updatedTotalGold,
            currentStreak: goldResult.newStreak,
            longestStreak: Math.max(userData.longestStreak || 0, goldResult.newStreak),
            perfectScores: updatedPerfect,
            completedQuests: updatedQuests,
            subjectsStudied,
            totalSubjects: totalSubjectsSnap.size,
        };

        // Get already earned badges
        const earnedSnap = await adminDb
            .collection("user_badges")
            .where("userId", "==", uid)
            .get();
        const earnedIds = earnedSnap.docs.map((d) => d.data().badgeId as string);

        const newBadges = checkNewBadges(stats, earnedIds);

        // Write new badges + update perfectScores counter
        if (newBadges.length > 0 || isPerfect) {
            const badgeBatch = adminDb.batch();

            for (const badge of newBadges) {
                const ref = adminDb.collection("user_badges").doc();
                badgeBatch.set(ref, {
                    userId: uid,
                    badgeId: badge.id,
                    name: badge.name,
                    icon: badge.icon,
                    earnedAt: FieldValue.serverTimestamp(),
                });
            }

            if (isPerfect) {
                badgeBatch.update(userRef, {
                    perfectScores: FieldValue.increment(1),
                });
            }

            await badgeBatch.commit();
        }

        // 8. Return result
        return NextResponse.json({
            attemptId: attemptRef.id,
            score,
            totalQuestions,
            goldEarned: {
                base: goldResult.base,
                perfectBonus: goldResult.perfectBonus,
                dailyBonus: goldResult.dailyBonus,
                streakBonus: goldResult.streakBonus,
                total: goldResult.total,
            },
            questsCompleted: questUpdates.filter((u) => u.completed).length,
            questGoldBonus,
            newBadges: newBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon, description: b.description })),
            mistakes: mistakes.map((m) => ({
                questionId: m.questionId,
                userAnswer: m.userAnswer,
                correctAnswer: m.correctAnswer,
            })),
        });
    } catch (error) {
        console.error("Quiz submit error:", error);
        return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 });
    }
}
