import { adminDb } from "../lib/firebase-admin";

async function reset() {
    console.log("🧹 Resetting active quests to force roadmap prioritization...");

    const snapshot = await adminDb.collection("quests").get();
    const batch = adminDb.batch();

    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Deleted ${snapshot.size} quests. Refresh the dashboard to see roadmap quests!`);
    process.exit(0);
}

reset().catch(err => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
});
