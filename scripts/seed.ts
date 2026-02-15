/**
 * Seed script — reads JSON files from data/subjects/ and writes to Firestore.
 * Structure: Subject → Quizzes → Questions
 * 
 * Usage: npx tsx scripts/seed.ts
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Manually load .env.local (no external deps needed)
const envPath = join(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    let value = trimmed.slice(eqIndex + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    process.env[key] = value;
}

const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

interface QuestionData {
    text: string;
    options: { id: string; text: string }[];
    correctOptionId?: string;
    correctOptionIds?: string[];
    explanation?: string;
    type?: "single" | "multi";
}

interface QuizData {
    quizId: string;
    title: string;
    description: string;
    questions: QuestionData[];
}

interface SubjectFile {
    subjectId: string;
    subjectName: string;
    subjectDescription: string;
    quizzes: QuizData[];
}

async function clearOldData() {
    console.log("Clearing old data...");
    const collections = ["subjects", "quizzes", "questions"];
    for (const col of collections) {
        const snapshot = await db.collection(col).get();
        if (snapshot.empty) continue;
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`  Deleted ${snapshot.size} docs from ${col}`);
    }
}

async function seed() {
    await clearOldData();

    const dataDir = join(process.cwd(), "data", "subjects");
    const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

    console.log(`\nFound ${files.length} subject files`);

    for (const file of files) {
        const raw = readFileSync(join(dataDir, file), "utf-8");
        const data: SubjectFile = JSON.parse(raw);

        const totalQuestions = data.quizzes.reduce((sum, q) => sum + q.questions.length, 0);
        console.log(`\nSeeding: ${data.subjectName} (${data.quizzes.length} quizzes, ${totalQuestions} questions)`);

        // Write subject doc
        await db.collection("subjects").doc(data.subjectId).set({
            id: data.subjectId,
            name: data.subjectName,
            description: data.subjectDescription,
            quizCount: data.quizzes.length,
            questionCount: totalQuestions,
        });

        // Write quizzes and questions
        for (const quiz of data.quizzes) {
            await db.collection("quizzes").doc(quiz.quizId).set({
                quizId: quiz.quizId,
                subjectId: data.subjectId,
                title: quiz.title,
                description: quiz.description,
                questionCount: quiz.questions.length,
            });

            const batch = db.batch();
            for (const q of quiz.questions) {
                const ref = db.collection("questions").doc();
                batch.set(ref, {
                    id: ref.id,
                    quizId: quiz.quizId,
                    subjectId: data.subjectId,
                    text: q.text,
                    options: q.options,
                    correctOptionId: q.correctOptionId || null,
                    correctOptionIds: q.correctOptionIds || null,
                    explanation: q.explanation || "",
                    type: q.type || (q.correctOptionIds ? "multi" : "single"),
                });
            }
            await batch.commit();
            console.log(`  ✓ Quiz: ${quiz.title} (${quiz.questions.length} questions)`);
        }
    }

    console.log("\n✅ Seed complete");
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
