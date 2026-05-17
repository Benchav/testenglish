import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const envContent = readFileSync('./.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) env[key] = rest.join('=');
});

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
    console.log("Testing write permissions...\n");
    const cred = await signInWithEmailAndPassword(auth, "lucimar132803@gmail.com", "luci2026");
    console.log("Authenticated as:", cred.user.uid);

    const tests = ['artifacts', 'examenes', 'preguntas', 'test_open', 'calificaciones'];
    for (const col of tests) {
        try {
            if (col === 'calificaciones') {
                await addDoc(collection(db, col), { uid: cred.user.uid, test: true, timestamp: new Date().toISOString() });
            } else {
                await setDoc(doc(db, col, '_test_write'), { test: true });
            }
            console.log(`  ${col}: WRITE OK ✓`);
        } catch (e) {
            console.log(`  ${col}: BLOCKED ✗ (${e.code})`);
        }
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
