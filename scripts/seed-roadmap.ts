import { adminDb } from "../lib/firebase-admin";

const roadmapData = [
    // WEEK 1: FOUNDATION
    { week: 1, type: "daily", description: "Complete 1 quiz to start your journey", trackingType: "complete_quiz", target: 1, goldReward: 25 },
    { week: 1, type: "daily", description: "Get at least 5 questions right today", trackingType: "correct_answers", target: 5, goldReward: 30 },
    { week: 1, type: "weekly", description: "Complete 5 quizzes in your first week", trackingType: "complete_quiz", target: 5, goldReward: 100 },

    // WEEK 2: MASTERY BASICS
    { week: 2, type: "daily", description: "Score a perfect 100% on any quiz", trackingType: "perfect_score", target: 1, goldReward: 40 },
    { week: 2, type: "daily", description: "Earn 40 gold today", trackingType: "earn_gold", target: 40, goldReward: 20 },
    { week: 2, type: "weekly", description: "Earn 150 gold this week", trackingType: "earn_gold", target: 150, goldReward: 120 },

    // WEEK 3: PERSISTENCE
    { week: 3, type: "daily", description: "Answer 15 questions correctly", trackingType: "correct_answers", target: 15, goldReward: 45 },
    { week: 3, type: "daily", description: "Complete 2 quizzes today", trackingType: "complete_quiz", target: 2, goldReward: 35 },
    { week: 3, type: "weekly", description: "Answer 60 questions correctly this week", trackingType: "correct_answers", target: 60, goldReward: 150 },

    // WEEK 4: DIVERSITY
    { week: 4, type: "daily", description: "Study 2 different subjects today", trackingType: "different_subjects", target: 2, goldReward: 50 },
    { week: 4, type: "daily", description: "Get a perfect score today", trackingType: "perfect_score", target: 1, goldReward: 45 },
    { week: 4, type: "weekly", description: "Study 4 different subjects this week", trackingType: "different_subjects", target: 4, goldReward: 180 },

    // WEEK 5: ACCELERATION
    { week: 5, type: "daily", description: "Complete 3 quizzes today", trackingType: "complete_quiz", target: 3, goldReward: 60 },
    { week: 5, type: "daily", description: "Get 20 correct answers today", trackingType: "correct_answers", target: 20, goldReward: 50 },
    { week: 5, type: "weekly", description: "Complete 12 quizzes this week", trackingType: "complete_quiz", target: 12, goldReward: 250 },

    // WEEK 6: DEEP FOCUS
    { week: 6, type: "daily", description: "Earn 100 gold from quizzes today", trackingType: "earn_gold", target: 100, goldReward: 50 },
    { week: 6, type: "daily", description: "Get 2 perfect scores today", trackingType: "perfect_score", target: 2, goldReward: 70 },
    { week: 6, type: "weekly", description: "Get 8 perfect scores this week", trackingType: "perfect_score", target: 8, goldReward: 300 },

    // WEEK 7: HABIT LOCK
    { week: 7, type: "daily", description: "Complete your daily habit quiz", trackingType: "complete_quiz", target: 1, goldReward: 40 },
    { week: 7, type: "daily", description: "Maintain your accuracy: 25 correct answers", trackingType: "correct_answers", target: 25, goldReward: 60 },
    { week: 7, type: "weekly", description: "Earn 300 gold this week", trackingType: "earn_gold", target: 300, goldReward: 250 },

    // WEEK 8: ADVANCED MASTERY
    { week: 8, type: "daily", description: "Mastery: Get 3 perfect scores", trackingType: "perfect_score", target: 3, goldReward: 100 },
    { week: 8, type: "daily", description: "Speed: Answer 40 questions correctly", trackingType: "correct_answers", target: 40, goldReward: 80 },
    { week: 8, type: "weekly", description: "Get 15 perfect scores this week", trackingType: "perfect_score", target: 15, goldReward: 400 },

    // WEEK 9: SUBJECT EXPLORER II
    { week: 9, type: "daily", description: "Study 3 different subjects today", trackingType: "different_subjects", target: 3, goldReward: 80 },
    { week: 9, type: "daily", description: "Earn 150 gold today", trackingType: "earn_gold", target: 150, goldReward: 75 },
    { week: 9, type: "weekly", description: "Complete 20 quizzes this week", trackingType: "complete_quiz", target: 20, goldReward: 500 },

    // WEEK 10: ELITE TRAINING
    { week: 10, type: "daily", description: "Elite: 50 correct answers today", trackingType: "correct_answers", target: 50, goldReward: 120 },
    { week: 10, type: "daily", description: "Consistency: 4 quizzes today", trackingType: "complete_quiz", target: 4, goldReward: 100 },
    { week: 10, type: "weekly", description: "Answer 250 questions correctly this week", trackingType: "correct_answers", target: 250, goldReward: 600 },

    // WEEK 11: PERFECTIONIST
    { week: 11, type: "daily", description: "Flawless: 5 perfect scores today", trackingType: "perfect_score", target: 5, goldReward: 200 },
    { week: 11, type: "daily", description: "Wealth: Earn 200 gold today", trackingType: "earn_gold", target: 200, goldReward: 100 },
    { week: 11, type: "weekly", description: "Get 25 perfect scores this week", trackingType: "perfect_score", target: 25, goldReward: 750 },

    // WEEK 12: LEGEND STATUS
    { week: 12, type: "daily", description: "Legend: 100 correct answers today", trackingType: "correct_answers", target: 100, goldReward: 300 },
    { week: 12, type: "daily", description: "Master: 5 quizzes today", trackingType: "complete_quiz", target: 5, goldReward: 200 },
    { week: 12, type: "weekly", description: "Earn 1000 gold in your final roadmap week", trackingType: "earn_gold", target: 1000, goldReward: 1000 },
];

async function seed() {
    console.log("🚀 Starting roadmap seeding...");

    const batch = adminDb.batch();
    const collection = adminDb.collection("quest_roadmap");

    // Optional: Clear existing roadmap
    const existing = await collection.get();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    console.log(`🗑️  Queued deletion for ${existing.size} existing roadmap quests.`);

    roadmapData.forEach((item, index) => {
        const id = `roadmap_w${item.week}_${index}`;
        const ref = collection.doc(id);
        batch.set(ref, {
            ...item,
            id,
            trackingMeta: {},
            createdAt: new Date()
        });
    });

    await batch.commit();
    console.log("✅ Roadmap seeded with 36 quests over 12 weeks.");
    process.exit(0);
}

seed().catch(err => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
