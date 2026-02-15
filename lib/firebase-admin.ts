import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";

const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

// Unique App Name to prevent HMR/Reload conflicts and force new config
const APP_NAME = "relife-admin";

const app =
    getApps().find(a => a.name === APP_NAME)
    || initializeApp({
        credential: cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    }, APP_NAME);

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminRtdb = getDatabase(app);
export default app;
