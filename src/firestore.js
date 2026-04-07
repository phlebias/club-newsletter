import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '../serviceAccountKey.json');
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Saves a report to Firestore and maintains the rolling 5 limit.
 * @param {Object} data - The report data.
 */
export async function saveReport(data) {
    console.log("[Firestore] Saving report...");
    const reportsRef = db.collection('reports');
    
    // Use a deterministic ID based on date and type to avoid duplicates
    // Format: YYYYMMDD_type (e.g. 20260320_evening)
    const reportId = `${data.sessionDate}_${data.targetType?.toLowerCase() || 'unknown'}`;
    
    await reportsRef.doc(reportId).set({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // Ensure date is stored as a searchable field
        recordedAt: new Date().toISOString()
    });

    console.log(`[Firestore] Report saved with ID: ${reportId}`);

    // Manage Rolling 5
    const snapshot = await reportsRef.orderBy('sessionDate', 'desc').get();
    if (snapshot.size > 5) {
        console.log(`[Firestore] Managing rolling 5 (Current count: ${snapshot.size})`);
        const deletePromises = [];
        snapshot.docs.slice(5).forEach(doc => {
            console.log(`[Firestore] Deleting older report: ${doc.id}`);
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);
    }
}

/**
 * Retrieves the 5 most recent reports.
 * @returns {Array} - The list of reports.
 */
export async function getLatestReports() {
    console.log("[Firestore] Fetching latest reports...");
    const snapshot = await db.collection('reports').orderBy('sessionDate', 'desc').limit(5).get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}
