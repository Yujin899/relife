/**
 * Achievements / Badges System
 * 
 * Badges are earned automatically when conditions are met.
 * Checked after every quiz submission.
 * Once earned, never revoked.
 */

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: "quiz" | "score" | "streak" | "gold" | "exploration" | "quest";
    condition: (stats: UserStats) => boolean;
}

export interface UserStats {
    totalQuizzes: number;
    totalCorrect: number;
    totalQuestions: number;
    totalGold: number;
    currentStreak: number;
    longestStreak: number;
    perfectScores: number;
    completedQuests: number;
    subjectsStudied: number;
    totalSubjects: number;
}

export const BADGES: Badge[] = [
    // ── Quiz Completion ─────────────────────
    {
        id: "first_steps",
        name: "First Steps",
        description: "Complete your first quiz",
        icon: "Target",
        category: "quiz",
        condition: (s) => s.totalQuizzes >= 1,
    },
    {
        id: "dedicated",
        name: "Dedicated",
        description: "Complete 10 quizzes",
        icon: "BookOpen",
        category: "quiz",
        condition: (s) => s.totalQuizzes >= 10,
    },
    {
        id: "scholar",
        name: "Scholar",
        description: "Complete 50 quizzes",
        icon: "GraduationCap",
        category: "quiz",
        condition: (s) => s.totalQuizzes >= 50,
    },
    {
        id: "academic",
        name: "Academic",
        description: "Complete 100 quizzes",
        icon: "Library",
        category: "quiz",
        condition: (s) => s.totalQuizzes >= 100,
    },

    // ── Perfect Scores ──────────────────────
    {
        id: "perfect_run",
        name: "Perfect Run",
        description: "Get a perfect score on any quiz",
        icon: "Star",
        category: "score",
        condition: (s) => s.perfectScores >= 1,
    },
    {
        id: "perfectionist",
        name: "Perfectionist",
        description: "Get 10 perfect scores",
        icon: "Gem",
        category: "score",
        condition: (s) => s.perfectScores >= 10,
    },
    {
        id: "flawless",
        name: "Flawless",
        description: "Get 25 perfect scores",
        icon: "Sparkles",
        category: "score",
        condition: (s) => s.perfectScores >= 25,
    },

    // ── Streaks ─────────────────────────────
    {
        id: "streak_starter",
        name: "Streak Starter",
        description: "Maintain a 3-day study streak",
        icon: "Flame",
        category: "streak",
        condition: (s) => s.longestStreak >= 3,
    },
    {
        id: "unstoppable",
        name: "Unstoppable",
        description: "Maintain a 7-day study streak",
        icon: "Zap",
        category: "streak",
        condition: (s) => s.longestStreak >= 7,
    },
    {
        id: "marathon",
        name: "Marathon",
        description: "Maintain a 14-day study streak",
        icon: "Trophy",
        category: "streak",
        condition: (s) => s.longestStreak >= 14,
    },
    {
        id: "legendary_streak",
        name: "Legendary",
        description: "Maintain a 30-day study streak",
        icon: "Crown",
        category: "streak",
        condition: (s) => s.longestStreak >= 30,
    },

    // ── Gold ────────────────────────────────
    {
        id: "gold_rush",
        name: "Gold Rush",
        description: "Earn 1,000 total gold",
        icon: "Coins",
        category: "gold",
        condition: (s) => s.totalGold >= 1000,
    },
    {
        id: "treasure_hunter",
        name: "Treasure Hunter",
        description: "Earn 10,000 total gold",
        icon: "Wallet",
        category: "gold",
        condition: (s) => s.totalGold >= 10000,
    },
    {
        id: "vault_keeper",
        name: "Vault Keeper",
        description: "Earn 50,000 total gold",
        icon: "Landmark",
        category: "gold",
        condition: (s) => s.totalGold >= 50000,
    },

    // ── Exploration ─────────────────────────
    {
        id: "explorer",
        name: "Explorer",
        description: "Complete quizzes in all available subjects",
        icon: "Compass",
        category: "exploration",
        condition: (s) => s.totalSubjects > 0 && s.subjectsStudied >= s.totalSubjects,
    },
    {
        id: "correct_100",
        name: "Century",
        description: "Answer 100 questions correctly",
        icon: "Target",
        category: "quiz",
        condition: (s) => s.totalCorrect >= 100,
    },
    {
        id: "correct_500",
        name: "Knowledge Base",
        description: "Answer 500 questions correctly",
        icon: "BrainCircuit",
        category: "quiz",
        condition: (s) => s.totalCorrect >= 500,
    },

    // ── Quests ──────────────────────────────
    {
        id: "quest_master",
        name: "Quest Master",
        description: "Complete 20 quests",
        icon: "Scroll",
        category: "quest",
        condition: (s) => s.completedQuests >= 20,
    },
    {
        id: "quest_legend",
        name: "Quest Legend",
        description: "Complete 50 quests",
        icon: "Map",
        category: "quest",
        condition: (s) => s.completedQuests >= 50,
    },

    // ── Leagues ─────────────────────────────
    {
        id: "league_silver",
        name: "Rising Star",
        description: "Reach Silver league",
        icon: "Shield",
        category: "gold",
        condition: (s) => s.totalGold >= 1000,
    },
    {
        id: "league_gold",
        name: "Elite",
        description: "Reach Gold league",
        icon: "ShieldAlert",
        category: "gold",
        condition: (s) => s.totalGold >= 5000,
    },
    {
        id: "league_platinum",
        name: "Champion",
        description: "Reach Platinum league",
        icon: "ShieldCheck",
        category: "gold",
        condition: (s) => s.totalGold >= 15000,
    },
    {
        id: "league_diamond",
        name: "Legend",
        description: "Reach Diamond league",
        icon: "Diamond",
        category: "gold",
        condition: (s) => s.totalGold >= 50000,
    },
];

/**
 * Given a user's stats and their already-earned badge IDs,
 * return the list of newly earned badge IDs.
 */
export function checkNewBadges(stats: UserStats, earnedBadgeIds: string[]): Badge[] {
    return BADGES.filter(
        (badge) => !earnedBadgeIds.includes(badge.id) && badge.condition(stats)
    );
}
