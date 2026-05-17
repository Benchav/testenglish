import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

const envContent = readFileSync('./.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) env[key] = rest.join('=');
});

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);
const auth = getAuth(app);

const OLD_ID = 'english-grammar-exam';
const NEW_ID = 'simple-present-and-present-continuous';

const newQuestions = [
    { id:1, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The official delegation ________ at 10:00 AM tomorrow, so we ________ for the airport in an hour.", options:["arrives / are leaving","is arriving / leave","arrives / leave","is arriving / are leaving"], correctIndex:0, hint:"Match the simple tense to the fixed timetable and the continuous tense to the personal arrangement." },
    { id:2, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"I ________ that you ________ a mistake by trusting him with the confidential data.", options:["am feeling / make","feel / are making","feel / make","am feeling / are making"], correctIndex:1, hint:"Determine which verb expresses a permanent state of mind and which expresses an ongoing action." },
    { id:3, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"Our competitors ________ a new strategy this quarter, which ________ why our sales are dropping.", options:["implement / is explaining","are implementing / explains","implement / explains","are implementing / is explaining"], correctIndex:1, hint:"Track the ongoing business trend with a continuous tense, but state the logical conclusion as a simple fact." },
    { id:4, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"Why ________ my tools without asking? You ________ doing this!", options:["do you borrow / always are","are you borrowing / always are","are you borrowing / are always","do you borrow / are always"], correctIndex:2, hint:"Look for the structure specifically designed to complain about a repetitive, irritating habit." },
    { id:5, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"In the final chapter, the protagonist ________ the villain's motives and ________ to forgive him.", options:["is understanding / decides","understands / is deciding","understands / decides","is understanding / is deciding"], correctIndex:2, hint:"Recall the tense standardly used by reviewers to summarize the plot of a book or movie." },
    { id:6, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"This soup ________ a bit bland. I ________ adding some spices.", options:["tastes / suggest","is tasting / suggest","tastes / am suggesting","is tasting / am suggesting"], correctIndex:0, hint:"Consider if the soup is performing an action or possessing a trait, and how performative verbs operate." },
    { id:7, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The security dog ________ the stranger's bag because it ________ suspicious.", options:["smells / is smelling","is smelling / smells","smells / smells","is smelling / is smelling"], correctIndex:1, hint:"Distinguish the active action of the animal from the passive odor of the object." },
    { id:8, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"I ________ what the manual says, but I ________ the technician tomorrow just to be sure.", options:["am seeing / see","see / am seeing","see / see","am seeing / am seeing"], correctIndex:1, hint:"Which 'see' refers to mental comprehension, and which refers to a scheduled appointment?" },
    { id:9, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The tailor ________ the fabric. He notes that it ________ completely smooth.", options:["feels / is feeling","is feeling / feels","feels / feels","is feeling / is feeling"], correctIndex:1, hint:"Separate the deliberate action of the human hands from the passive characteristic of the cloth." },
    { id:10, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"She ________ out the window instead of working. She ________ very distracted today.", options:["looks / is appearing","is looking / appears","looks / appears","is looking / is appearing"], correctIndex:1, hint:"Identify the active visual action versus the passive impression she gives." },
    { id:11, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The guest speaker ________ at the conference tonight, but he ________ to be running late.", options:["is appearing / appears","appears / is appearing","appears / appears","is appearing / is appearing"], correctIndex:0, hint:"Notice how 'appear' changes from 'giving a presentation' to 'giving the impression of'." },
    { id:12, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The nurse ________ the infant to check his development. He ________ 8 pounds.", options:["weighs / is weighing","is weighing / weighs","weighs / weighs","is weighing / is weighing"], correctIndex:1, hint:"Which clause describes a human operating a scale, and which describes the physical mass of the baby?" },
    { id:13, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The architect ________ the room because the blueprint ________ a different dimension.", options:["measures / indicates","is measuring / is indicating","is measuring / indicates","measures / is indicating"], correctIndex:2, hint:"Contrast the active human measurement process with the static information on a piece of paper." },
    { id:14, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"This new software ________ our needs perfectly, so we ________ to purchase the enterprise license.", options:["fits / are planning","is fitting / plan","fits / plan","is fitting / are planning"], correctIndex:0, hint:"Remember that 'fit' (meaning suitability or size) is almost always stative." },
    { id:15, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"How much ________ to upgrade the servers? We ________ to cut expenses this month.", options:["is it costing / try","does it cost / are trying","does it cost / try","is it costing / are trying"], correctIndex:1, hint:"Price is a state. The effort to save money 'this month' is a temporary action." },
    { id:16, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The economic situation ________ worse, and the board ________ that immediate action is required.", options:["gets / is agreeing","is getting / agrees","gets / agrees","is getting / is agreeing"], correctIndex:1, hint:"Use the continuous for developing changes and the simple tense for a state of consensus." },
    { id:17, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"He normally ________ complex negotiations, but he ________ a minor dispute today.", options:["handles / settles","is handling / is settling","handles / is settling","is handling / settles"], correctIndex:2, hint:"Match the simple present to the baseline routine and the continuous to today's exception." },
    { id:18, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The chef ________ the batter, ________ it into the pan, and waits for it to turn golden.", options:["is whisking / is pouring","whisks / pours","whisks / is pouring","is whisking / pours"], correctIndex:1, hint:"Recall the tense used by TV chefs and sports commentators to describe live sequential events." },
    { id:19, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"In the second act, the hero ________ a hidden diary that ________ all the family secrets.", options:["is finding / is containing","finds / contains","finds / is containing","is finding / contains"], correctIndex:1, hint:"Plot summaries use the simple present, and the verb for 'holding contents' is strictly stative." },
    { id:20, instruction:"Choose the correct option to complete the sentence:", englishText:"I will send you the finalized document as soon as the client ________ it.", options:["is approving","approves","will approve","will be approving"], correctIndex:1, hint:"Remember the strict rule for verbs following time conjunctions like 'as soon as' or 'when' pointing to the future." },
    { id:21, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"You ________ very impatient today. You usually ________ such a calm demeanor.", options:["are being / have","are / are having","are being / are having","are / have"], correctIndex:0, hint:"Look for the structure that shows temporary behavior contrasting with a permanent character trait." },
    { id:22, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The committee ________ of five members, and they ________ the applicants right now.", options:["is consisting / interview","consists / are interviewing","consists / interview","is consisting / are interviewing"], correctIndex:1, hint:"Composition is a permanent state; interviewing is a live action." },
    { id:23, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"I ________ you are right, but I ________ to sign the contract without my lawyer.", options:["am supposing / am preferring","suppose / prefer","suppose / am preferring","am supposing / prefer"], correctIndex:1, hint:"Consider whether mental assumptions and preferences are actions or abstract states." },
    { id:24, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"I ________ that I will finish the report by Friday. I ________ on it constantly.", options:["promise / am working","am promising / work","promise / work","am promising / am working"], correctIndex:0, hint:"Verbs that perform the action they describe (promise, swear, apologize) use the simple present." },
    { id:25, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"Whether we launch the product tomorrow ________ on the testing phase, which ________ well so far.", options:["is depending / goes","depends / is going","depends / goes","is depending / is going"], correctIndex:1, hint:"Conditional reliance is a state, while the testing process is an active progression." },
    { id:26, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"This rare artifact ________ to the national museum. They ________ it in the main hall this month.", options:["is belonging / display","belongs / are displaying","belongs / display","is belonging / are displaying"], correctIndex:1, hint:"Ownership is a permanent state; exhibitions can be temporary arrangements." },
    { id:27, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"It ________ if we win or lose. What matters is that we ________ our best right now.", options:["isn't mattering / try","doesn't matter / are trying","doesn't matter / try","isn't mattering / are trying"], correctIndex:1, hint:"Importance is a state; effort is an action." },
    { id:28, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"I ________ that you are upset, but I ________ my best to fix the issue.", options:["am realizing / do","realize / am doing","realize / do","am realizing / am doing"], correctIndex:1, hint:"Awareness is a state of mind; trying to fix something is a physical effort." },
    { id:29, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"The company ________ a new branch in Tokyo, which ________ why she is traveling so much.", options:["opens / is explaining","is opening / explains","opens / explains","is opening / is explaining"], correctIndex:1, hint:"Match the continuous form to the corporate project and the simple form to the logical conclusion." },
    { id:30, instruction:"Choose the correct verb forms to complete the sentence:", englishText:"Listen! The alarm ________! That ________ we need to evacuate the building immediately.", options:["rings / is meaning","is ringing / means","rings / means","is ringing / is meaning"], correctIndex:1, hint:"The exclamation 'Listen!' implies an action happening right now. 'Mean' expresses a definition." }
];

async function main() {
    console.log("=== FIREBASE MIGRATION ===\n");
    await signInWithEmailAndPassword(auth, "lucimar132803@gmail.com", "luci2026");
    console.log("Authenticated as docente.\n");

    // 1. Tag existing questions with examId
    console.log("1. Tagging existing questions...");
    const existing = await getDocs(collection(db, 'preguntas'));
    let tagged = 0;
    for (const snap of existing.docs) {
        if (!snap.data().examId) {
            await updateDoc(doc(db, 'preguntas', snap.id), { examId: OLD_ID });
            tagged++;
        }
    }
    console.log(`   Tagged ${tagged} questions with "${OLD_ID}"`);

    // 2. Upload new questions
    console.log("2. Uploading 30 new questions...");
    for (const q of newQuestions) {
        await setDoc(doc(db, 'preguntas', `sppc-q${q.id.toString().padStart(2,'0')}`), { ...q, examId: NEW_ID });
    }
    console.log("   Done.");

    // 3. Create exam catalog
    console.log("3. Creating exam catalog...");
    await setDoc(doc(db, 'examenes', OLD_ID), {
        examId: OLD_ID, title: 'English Grammar Exam',
        description: 'Comprehensive exam covering grammar fundamentals: quantifiers, prepositions, modals, and more.',
        totalQuestions: existing.size, active: true, order: 1, createdAt: new Date().toISOString()
    }, { merge: true });
    await setDoc(doc(db, 'examenes', NEW_ID), {
        examId: NEW_ID, title: 'Simple Present and Present Continuous',
        description: 'Advanced exam on stative vs. dynamic verbs, scheduled events, and temporary vs. permanent actions.',
        totalQuestions: 30, active: true, order: 2, createdAt: new Date().toISOString()
    }, { merge: true });
    console.log("   Done.");

    // 4. Verify
    const allQ = await getDocs(collection(db, 'preguntas'));
    const allE = await getDocs(collection(db, 'examenes'));
    console.log(`\nVerification: ${allQ.size} questions, ${allE.size} exams.`);
    allE.docs.forEach(d => console.log(`  - ${d.data().title} (${d.data().totalQuestions}q)`));
    console.log("\n=== COMPLETE ===");
    process.exit(0);
}
main().catch(e => { console.error("ERROR:", e); process.exit(1); });
