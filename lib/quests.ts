/**
 * Smart Quest System
 * 
 * - Fully automated: no admin/code updates needed
 * - Dynamic: adapts to subjects and quizzes from Firestore
 * - Auto-tracked: progress updates automatically on quiz submission
 * 
 * Tracking types define WHAT action increments a quest's progress.
 */

// ─── Types ──────────────────────────────────────────────────────────

export type TrackingType =
    | "complete_quiz"                   // Complete any quiz
    | "complete_quiz_in_subject"        // Complete a quiz in a specific subject
    | "perfect_score"                   // Get 100% on any quiz
    | "perfect_score_in_subject"        // Get 100% in a specific subject
    | "correct_answers"                 // Answer N questions correctly (across quizzes)
    | "earn_gold"                       // Earn N gold (across quizzes)
    | "different_subjects"              // Complete quizzes in N different subjects
    | "streak_days";                    // Have a streak of N days

export interface QuestData {
    userId: string;
    templateId: string;
    type: "daily" | "weekly";
    description: string;
    trackingType: TrackingType;
    trackingMeta?: Record<string, string>;  // e.g. { subjectId: "math-101" }
    progress: number;
    target: number;
    completed: boolean;
    goldReward: number;
    assignedAt: Date;
    expiresAt: Date;
}

// ─── Static Templates (no Firestore needed) ─────────────────────────

interface StaticTemplate {
    id: string;
    type: "daily" | "weekly";
    description: string;
    trackingType: TrackingType;
    target: number;
    goldReward: number;
}

const STATIC_DAILY_TEMPLATES: StaticTemplate[] = [
    {
        id: "daily_complete_1",
        type: "daily",
        description: "Complete 1 quiz today",
        trackingType: "complete_quiz",
        target: 1,
        goldReward: 20,
    },
    {
        id: "daily_complete_3",
        type: "daily",
        description: "Complete 3 quizzes today",
        trackingType: "complete_quiz",
        target: 3,
        goldReward: 50,
    },
    {
        id: "daily_perfect",
        type: "daily",
        description: "Score 100% on any quiz",
        trackingType: "perfect_score",
        target: 1,
        goldReward: 40,
    },
    {
        id: "daily_correct_10",
        type: "daily",
        description: "Answer 10 questions correctly today",
        trackingType: "correct_answers",
        target: 10,
        goldReward: 30,
    },
    {
        id: "daily_correct_20",
        type: "daily",
        description: "Answer 20 questions correctly today",
        trackingType: "correct_answers",
        target: 20,
        goldReward: 60,
    },
    {
        id: "daily_earn_50",
        type: "daily",
        description: "Earn 50 gold today",
        trackingType: "earn_gold",
        target: 50,
        goldReward: 25,
    },
    {
        id: "daily_2_subjects",
        type: "daily",
        description: "Complete quizzes in 2 different subjects today",
        trackingType: "different_subjects",
        target: 2,
        goldReward: 40,
    },
];

const STATIC_WEEKLY_TEMPLATES: StaticTemplate[] = [
    {
        id: "weekly_complete_5",
        type: "weekly",
        description: "Complete 5 quizzes this week",
        trackingType: "complete_quiz",
        target: 5,
        goldReward: 100,
    },
    {
        id: "weekly_complete_10",
        type: "weekly",
        description: "Complete 10 quizzes this week",
        trackingType: "complete_quiz",
        target: 10,
        goldReward: 200,
    },
    {
        id: "weekly_perfect_3",
        type: "weekly",
        description: "Get 3 perfect scores this week",
        trackingType: "perfect_score",
        target: 3,
        goldReward: 150,
    },
    {
        id: "weekly_correct_50",
        type: "weekly",
        description: "Answer 50 questions correctly this week",
        trackingType: "correct_answers",
        target: 50,
        goldReward: 120,
    },
    {
        id: "weekly_earn_200",
        type: "weekly",
        description: "Earn 200 gold this week",
        trackingType: "earn_gold",
        target: 200,
        goldReward: 80,
    },
    {
        id: "weekly_streak_3",
        type: "weekly",
        description: "Maintain a 3-day study streak",
        trackingType: "streak_days",
        target: 3,
        goldReward: 100,
    },
    {
        id: "weekly_streak_5",
        type: "weekly",
        description: "Maintain a 5-day study streak",
        trackingType: "streak_days",
        target: 5,
        goldReward: 180,
    },
];

// ─── Dynamic Templates (generated from Firestore data) ──────────────

interface SubjectInfo {
    id: string;
    name: string;
    quizCount: number;
}

/**
 * Generate subject-specific quest templates dynamically.
 * These are personalized quests like "Complete 2 quizzes in Mathematics 101".
 */
function generateSubjectTemplates(subjects: SubjectInfo[]): StaticTemplate[] {
    const templates: StaticTemplate[] = [];

    for (const subject of subjects) {
        // Daily: Complete 1 quiz in [subject]
        templates.push({
            id: `daily_subject_${subject.id}`,
            type: "daily",
            description: `Complete a quiz in ${subject.name}`,
            trackingType: "complete_quiz_in_subject",
            target: 1,
            goldReward: 25,
        });

        // Daily: Perfect score in [subject]
        templates.push({
            id: `daily_perfect_${subject.id}`,
            type: "daily",
            description: `Score 100% on a ${subject.name} quiz`,
            trackingType: "perfect_score_in_subject",
            target: 1,
            goldReward: 45,
        });

        // Weekly: Complete 3 quizzes in [subject]
        if (subject.quizCount >= 2) {
            templates.push({
                id: `weekly_subject_${subject.id}`,
                type: "weekly",
                description: `Complete ${Math.min(3, subject.quizCount)} quizzes in ${subject.name}`,
                trackingType: "complete_quiz_in_subject",
                target: Math.min(3, subject.quizCount),
                goldReward: 100,
            });
        }
    }

    // If multiple subjects, add "all subjects" weekly quest
    if (subjects.length >= 2) {
        templates.push({
            id: "weekly_all_subjects",
            type: "weekly",
            description: `Study all ${subjects.length} subjects this week`,
            trackingType: "different_subjects",
            target: subjects.length,
            goldReward: 150,
        });
    }

    return templates;
}

// ─── Expiration helpers ─────────────────────────────────────────────

/**
 * Returns the exact UTC timestamp for 23:59:59.999 of the current day.
 */
export function getEndOfDayUTC(): Date {
    const now = new Date();
    const end = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23, 59, 59, 999
    ));
    return end;
}

/**
 * Returns the exact UTC timestamp for 23:59:59.999 of the upcoming Sunday.
 */
export function getEndOfWeekUTC(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 (Sun) to 6 (Sat)

    // Days until Sunday: Sun=0, Mon=6, Tue=5, Wed=4, Thu=3, Fri=2, Sat=1
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    const end = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysUntilSunday,
        23, 59, 59, 999
    ));
    return end;
}

// ─── Quest generation ───────────────────────────────────────────────

function pickRandom<T extends { id: string }>(
    pool: T[],
    count: number,
    excludeIds: string[],
    prioritizePrefix?: string
): T[] {
    const filtered = pool.filter((item) => !excludeIds.includes(item.id));

    if (prioritizePrefix) {
        const priority = filtered.filter(item => item.id.includes(prioritizePrefix));
        const rest = filtered.filter(item => !item.id.includes(prioritizePrefix));

        // Shuffle within groups to keep it interesting but preserve priority
        const shuffledPriority = [...priority].sort(() => 0.5 - Math.random());
        const shuffledRest = [...rest].sort(() => 0.5 - Math.random());

        return [...shuffledPriority, ...shuffledRest].slice(0, count);
    }

    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/**
 * Generate quests, using subjects from Firestore for dynamic templates.
 * Called by the quests API route.
 */
export function generateMissingQuests(
    existingDailyIds: string[],
    existingWeeklyIds: string[],
    userId: string,
    subjects: SubjectInfo[] = [],
    customTemplates: any[] = [],
    roadmapTemplates: any[] = [],
    intelligence: { masteryLevel?: number; neglectedSubjectIds?: string[] } = {}
): QuestData[] {
    const subjectTemplates = generateSubjectTemplates(subjects);

    // Merge static + dynamic + CUSTOM admin templates + ROADMAP
    const roadmapDaily = roadmapTemplates.filter(t => t.type === "daily");
    const roadmapWeekly = roadmapTemplates.filter(t => t.type === "weekly");
    const customDaily = customTemplates.filter(t => t.type === "daily");
    const customWeekly = customTemplates.filter(t => t.type === "weekly");

    // Intelligence: Prioritize neglected subjects in subjectTemplates
    const prioritizedSubjectTemplates = [...subjectTemplates].sort((a, b) => {
        if (!intelligence.neglectedSubjectIds) return 0;
        const aNeglected = intelligence.neglectedSubjectIds.includes(a.id.split("_").pop() || "");
        const bNeglected = intelligence.neglectedSubjectIds.includes(b.id.split("_").pop() || "");
        return aNeglected ? -1 : bNeglected ? 1 : 0;
    });

    const allDaily = [
        ...roadmapDaily, // Roadmap has HIGHEST priority
        ...customDaily,
        ...STATIC_DAILY_TEMPLATES,
        ...prioritizedSubjectTemplates.filter((t) => t.type === "daily"),
    ];
    const allWeekly = [
        ...roadmapWeekly,
        ...customWeekly,
        ...STATIC_WEEKLY_TEMPLATES,
        ...prioritizedSubjectTemplates.filter((t) => t.type === "weekly"),
    ];

    const newQuests: QuestData[] = [];

    // Intelligence factors
    const difficultyMultiplier = (intelligence.masteryLevel || 0) > 0.8 ? 1.25 : 1;

    // 3 daily quests
    const dailyNeeded = Math.max(0, 3 - existingDailyIds.length);
    if (dailyNeeded > 0) {
        // Prioritize roadmap items specifically
        const picked = pickRandom(allDaily, dailyNeeded, existingDailyIds, "roadmap");
        for (const template of picked) {
            const meta = template.trackingMeta || buildTrackingMeta(template, subjects);

            // Apply difficulty scaling to target
            let finalTarget = template.target;
            if (difficultyMultiplier > 1 && !template.id.includes("roadmap")) {
                finalTarget = Math.ceil(template.target * difficultyMultiplier);
            }

            newQuests.push({
                userId,
                templateId: template.id,
                type: "daily",
                description: template.description + (finalTarget > template.target ? " (Master Class)" : ""),
                trackingType: template.trackingType as TrackingType,
                trackingMeta: meta,
                progress: 0,
                target: finalTarget,
                completed: false,
                goldReward: Math.ceil(template.goldReward * (finalTarget > template.target ? 1.2 : 1)),
                assignedAt: new Date(),
                expiresAt: getEndOfDayUTC(),
            });
        }
    }

    // 2 weekly quests
    const weeklyNeeded = Math.max(0, 2 - existingWeeklyIds.length);
    if (weeklyNeeded > 0) {
        // Prioritize roadmap items specifically
        const picked = pickRandom(allWeekly, weeklyNeeded, existingWeeklyIds, "roadmap");
        for (const template of picked) {
            const meta = template.trackingMeta || buildTrackingMeta(template, subjects);

            let finalTarget = template.target;
            if (difficultyMultiplier > 1 && !template.id.includes("roadmap")) {
                finalTarget = Math.ceil(template.target * difficultyMultiplier);
            }

            newQuests.push({
                userId,
                templateId: template.id,
                type: "weekly",
                description: template.description + (finalTarget > template.target ? " (Seasoned)" : ""),
                trackingType: template.trackingType as TrackingType,
                trackingMeta: meta,
                progress: 0,
                target: finalTarget,
                completed: false,
                goldReward: Math.ceil(template.goldReward * (finalTarget > template.target ? 1.2 : 1)),
                assignedAt: new Date(),
                expiresAt: getEndOfWeekUTC(),
            });
        }
    }

    return newQuests;
}

/**
 * Extract tracking metadata from template ID.
 * For subject-specific templates, stores the subjectId.
 */
function buildTrackingMeta(
    template: StaticTemplate,
    subjects: SubjectInfo[]
): Record<string, string> | undefined {
    if (
        template.trackingType === "complete_quiz_in_subject" ||
        template.trackingType === "perfect_score_in_subject"
    ) {
        // Extract subjectId from template ID like "daily_subject_math-101"
        const subject = subjects.find((s) => template.id.includes(s.id));
        if (subject) {
            return { subjectId: subject.id };
        }
    }
    return undefined;
}

// ─── Progress tracking (called after quiz submit) ───────────────────

export interface QuizResult {
    score: number;
    totalQuestions: number;
    goldEarned: number;
    subjectId: string;
    newStreak: number;
}

export interface QuestUpdate {
    questId: string;
    newProgress: number;
    completed: boolean;
    goldReward: number;
}

/**
 * Given active quests and a quiz result, compute which quests should be updated.
 * Returns an array of updates to apply via batch write.
 */
export function computeQuestUpdates(
    activeQuests: {
        id: string;
        trackingType: TrackingType;
        trackingMeta?: Record<string, string>;
        progress: number;
        target: number;
        completed: boolean;
        goldReward: number;
        subjectsToday?: string[];  // tracked subjects for "different_subjects" type
    }[],
    result: QuizResult
): QuestUpdate[] {
    const updates: QuestUpdate[] = [];
    const isPerfect = result.score === result.totalQuestions;

    for (const quest of activeQuests) {
        if (quest.completed) continue;

        let increment = 0;

        switch (quest.trackingType) {
            case "complete_quiz":
                increment = 1;
                break;

            case "complete_quiz_in_subject":
                if (quest.trackingMeta?.subjectId === result.subjectId) {
                    increment = 1;
                }
                break;

            case "perfect_score":
                if (isPerfect) increment = 1;
                break;

            case "perfect_score_in_subject":
                if (isPerfect && quest.trackingMeta?.subjectId === result.subjectId) {
                    increment = 1;
                }
                break;

            case "correct_answers":
                increment = result.score;
                break;

            case "earn_gold":
                increment = result.goldEarned;
                break;

            case "different_subjects": {
                // Check if this subject was already counted
                const alreadyCounted = quest.subjectsToday || [];
                if (!alreadyCounted.includes(result.subjectId)) {
                    increment = 1;
                }
                break;
            }

            case "streak_days":
                // Streak is set to the actual streak value, not incremented
                if (result.newStreak >= quest.target && quest.progress < quest.target) {
                    increment = quest.target - quest.progress; // Jump to target
                }
                break;
        }

        if (increment > 0) {
            const newProgress = Math.min(quest.progress + increment, quest.target);
            updates.push({
                questId: quest.id,
                newProgress,
                completed: newProgress >= quest.target,
                goldReward: quest.goldReward,
            });
        }
    }

    return updates;
}
