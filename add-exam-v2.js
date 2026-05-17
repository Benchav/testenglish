import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';

// Parse .env manually (Node doesn't have import.meta.env)
const envContent = readFileSync('./.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) env[key] = rest.join('=');
});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const TEACHER_EMAIL = "lucimar132803@gmail.com";
const TEACHER_PASS = "luci2026";

const EXAM_ID_OLD = 'english-grammar-exam';
const EXAM_ID_NEW = 'simple-present-and-present-continuous';

const newQuestions = [
    { id: 1, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The official delegation ________ at 10:00 AM tomorrow, so we ________ for the airport in an hour.", options: ["arrives / are leaving", "is arriving / leave", "arrives / leave", "is arriving / are leaving"], correctIndex: 0, hint: "Match the simple tense to the fixed timetable and the continuous tense to the personal arrangement.", explanation: "The simple present ('arrives') is used for fixed official schedules, while the present continuous ('are leaving') is used for personal future arrangements." },
    { id: 2, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "I ________ that you ________ a mistake by trusting him with the confidential data.", options: ["am feeling / make", "feel / are making", "feel / make", "am feeling / are making"], correctIndex: 1, hint: "Determine which verb expresses a permanent state of mind and which expresses an ongoing action.", explanation: "'Feel' expresses a stative opinion, while 'are making' describes an active, ongoing error in judgment." },
    { id: 3, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "Our competitors ________ a new strategy this quarter, which ________ why our sales are dropping.", options: ["implement / is explaining", "are implementing / explains", "implement / explains", "are implementing / is explaining"], correctIndex: 1, hint: "Track the ongoing business trend with a continuous tense, but state the logical conclusion as a simple fact.", explanation: "'Are implementing' shows a temporary, ongoing trend this quarter. 'Explains' functions as a stative declaration of cause." },
    { id: 4, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "Why ________ my tools without asking? You ________ doing this!", options: ["do you borrow / always are", "are you borrowing / always are", "are you borrowing / are always", "do you borrow / are always"], correctIndex: 2, hint: "Look for the structure specifically designed to complain about a repetitive, irritating habit.", explanation: "The present continuous, especially when paired with 'always', is the exact grammatical structure used to express frustration or annoyance." },
    { id: 5, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "In the final chapter, the protagonist ________ the villain's motives and ________ to forgive him.", options: ["is understanding / decides", "understands / is deciding", "understands / decides", "is understanding / is deciding"], correctIndex: 2, hint: "Recall the tense standardly used by reviewers to summarize the plot of a book or movie.", explanation: "The simple present is universally used for summarizing plots in literature and film (the historical present)." },
    { id: 6, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "This soup ________ a bit bland. I ________ adding some spices.", options: ["tastes / suggest", "is tasting / suggest", "tastes / am suggesting", "is tasting / am suggesting"], correctIndex: 0, hint: "Consider if the soup is performing an action or possessing a trait, and how performative verbs operate.", explanation: "'Taste' is a stative sensory quality here. 'Suggest' is a performative verb, usually kept in the simple present." },
    { id: 7, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The security dog ________ the stranger's bag because it ________ suspicious.", options: ["smells / is smelling", "is smelling / smells", "smells / smells", "is smelling / is smelling"], correctIndex: 1, hint: "Distinguish the active action of the animal from the passive odor of the object.", explanation: "The dog is actively sniffing (dynamic continuous), while the bag passively emits an odor (stative simple)." },
    { id: 8, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "I ________ what the manual says, but I ________ the technician tomorrow just to be sure.", options: ["am seeing / see", "see / am seeing", "see / see", "am seeing / am seeing"], correctIndex: 1, hint: "Which 'see' refers to mental comprehension, and which refers to a scheduled appointment?", explanation: "'See' means 'understand' (stative). 'Am seeing' means 'meeting with' as a future arrangement (dynamic)." },
    { id: 9, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The tailor ________ the fabric. He notes that it ________ completely smooth.", options: ["feels / is feeling", "is feeling / feels", "feels / feels", "is feeling / is feeling"], correctIndex: 1, hint: "Separate the deliberate action of the human hands from the passive characteristic of the cloth.", explanation: "The active physical touch is dynamic ('is feeling'), while the inherent texture of the fabric is stative ('feels')." },
    { id: 10, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "She ________ out the window instead of working. She ________ very distracted today.", options: ["looks / is appearing", "is looking / appears", "looks / appears", "is looking / is appearing"], correctIndex: 1, hint: "Identify the active visual action versus the passive impression she gives.", explanation: "'Is looking' is an active physical action. 'Appears' is a stative verb meaning 'seems'." },
    { id: 11, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The guest speaker ________ at the conference tonight, but he ________ to be running late.", options: ["is appearing / appears", "appears / is appearing", "appears / appears", "is appearing / is appearing"], correctIndex: 0, hint: "Notice how 'appear' changes from 'giving a presentation' to 'giving the impression of'.", explanation: "'Is appearing' dynamically means 'performing/presenting'. 'Appears' statively means 'seems'." },
    { id: 12, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The nurse ________ the infant to check his development. He ________ 8 pounds.", options: ["weighs / is weighing", "is weighing / weighs", "weighs / weighs", "is weighing / is weighing"], correctIndex: 1, hint: "Which clause describes a human operating a scale, and which describes the physical mass of the baby?", explanation: "The active physical measurement is dynamic ('is weighing'), while possessing mass is a state ('weighs')." },
    { id: 13, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The architect ________ the room because the blueprint ________ a different dimension.", options: ["measures / indicates", "is measuring / is indicating", "is measuring / indicates", "measures / is indicating"], correctIndex: 2, hint: "Contrast the active human measurement process with the static information on a piece of paper.", explanation: "The action of measuring is ongoing (continuous), but what a document states is a permanent fact (simple)." },
    { id: 14, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "This new software ________ our needs perfectly, so we ________ to purchase the enterprise license.", options: ["fits / are planning", "is fitting / plan", "fits / plan", "is fitting / are planning"], correctIndex: 0, hint: "Remember that 'fit' (meaning suitability or size) is almost always stative.", explanation: "'Fit' is a stative verb of suitability. 'Planning' is an active, ongoing administrative process." },
    { id: 15, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "How much ________ to upgrade the servers? We ________ to cut expenses this month.", options: ["is it costing / try", "does it cost / are trying", "does it cost / try", "is it costing / are trying"], correctIndex: 1, hint: "Price is a state. The effort to save money 'this month' is a temporary action.", explanation: "'Cost' is stative (a fixed price). 'Are trying' reflects a temporary, ongoing effort specific to 'this month'." },
    { id: 16, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The economic situation ________ worse, and the board ________ that immediate action is required.", options: ["gets / is agreeing", "is getting / agrees", "gets / agrees", "is getting / is agreeing"], correctIndex: 1, hint: "Use the continuous for developing changes and the simple tense for a state of consensus.", explanation: "'Is getting' highlights an active, developing trend. 'Agrees' is a stative verb expressing a shared opinion." },
    { id: 17, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "He normally ________ complex negotiations, but he ________ a minor dispute today.", options: ["handles / settles", "is handling / is settling", "handles / is settling", "is handling / settles"], correctIndex: 2, hint: "Match the simple present to the baseline routine and the continuous to today's exception.", explanation: "Simple present sets the permanent routine ('normally'), and present continuous marks the temporary deviation ('today')." },
    { id: 18, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The chef ________ the batter, ________ it into the pan, and waits for it to turn golden.", options: ["is whisking / is pouring", "whisks / pours", "whisks / is pouring", "is whisking / pours"], correctIndex: 1, hint: "Recall the tense used by TV chefs and sports commentators to describe live sequential events.", explanation: "Live demonstrations, like sports commentaries, use the simple present for rapid, sequential actions." },
    { id: 19, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "In the second act, the hero ________ a hidden diary that ________ all the family secrets.", options: ["is finding / is containing", "finds / contains", "finds / is containing", "is finding / contains"], correctIndex: 1, hint: "Plot summaries use the simple present, and the verb for 'holding contents' is strictly stative.", explanation: "Plot summaries use the simple present ('finds'), and 'contains' is a purely stative verb of composition." },
    { id: 20, examId: EXAM_ID_NEW, instruction: "Choose the correct option to complete the sentence:", englishText: "I will send you the finalized document as soon as the client ________ it.", options: ["is approving", "approves", "will approve", "will be approving"], correctIndex: 1, hint: "Remember the strict rule for verbs following time conjunctions like 'as soon as' or 'when' pointing to the future.", explanation: "In subordinate time clauses (after 'when', 'as soon as', 'until') referring to the future, the simple present must be used." },
    { id: 21, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "You ________ very impatient today. You usually ________ such a calm demeanor.", options: ["are being / have", "are / are having", "are being / are having", "are / have"], correctIndex: 0, hint: "Look for the structure that shows temporary behavior contrasting with a permanent character trait.", explanation: "'Are being' highlights temporary behavior today, while 'have' is a stative verb showing normal possession of a trait." },
    { id: 22, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The committee ________ of five members, and they ________ the applicants right now.", options: ["is consisting / interview", "consists / are interviewing", "consists / interview", "is consisting / are interviewing"], correctIndex: 1, hint: "Composition is a permanent state; interviewing is a live action.", explanation: "'Consists' is a purely stative verb of composition. 'Are interviewing' is a dynamic action in progress." },
    { id: 23, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "I ________ you are right, but I ________ to sign the contract without my lawyer.", options: ["am supposing / am preferring", "suppose / prefer", "suppose / am preferring", "am supposing / prefer"], correctIndex: 1, hint: "Consider whether mental assumptions and preferences are actions or abstract states.", explanation: "Both verbs express states of mind and preferences, which require the simple present tense." },
    { id: 24, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "I ________ that I will finish the report by Friday. I ________ on it constantly.", options: ["promise / am working", "am promising / work", "promise / work", "am promising / am working"], correctIndex: 0, hint: "Verbs that perform the action they describe (promise, swear, apologize) use the simple present.", explanation: "'Promise' is a performative verb used in simple present. 'Am working' shows the active, ongoing effort." },
    { id: 25, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "Whether we launch the product tomorrow ________ on the testing phase, which ________ well so far.", options: ["is depending / goes", "depends / is going", "depends / goes", "is depending / is going"], correctIndex: 1, hint: "Conditional reliance is a state, while the testing process is an active progression.", explanation: "'Depends' is a stative verb of condition. 'Is going' reflects the active, developing progress of the tests." },
    { id: 26, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "This rare artifact ________ to the national museum. They ________ it in the main hall this month.", options: ["is belonging / display", "belongs / are displaying", "belongs / display", "is belonging / are displaying"], correctIndex: 1, hint: "Ownership is a permanent state; exhibitions can be temporary arrangements.", explanation: "'Belongs' describes permanent ownership (stative). 'Are displaying' notes a temporary exhibition ('this month')." },
    { id: 27, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "It ________ if we win or lose. What matters is that we ________ our best right now.", options: ["isn't mattering / try", "doesn't matter / are trying", "doesn't matter / try", "isn't mattering / are trying"], correctIndex: 1, hint: "Importance is a state; effort is an action.", explanation: "'Doesn't matter' is a stative fact. 'Are trying' is the active, dynamic effort happening 'right now'." },
    { id: 28, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "I ________ that you are upset, but I ________ my best to fix the issue.", options: ["am realizing / do", "realize / am doing", "realize / do", "am realizing / am doing"], correctIndex: 1, hint: "Awareness is a state of mind; trying to fix something is a physical effort.", explanation: "'Realize' is a stative verb of cognition. 'Am doing' shows active, ongoing effort." },
    { id: 29, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "The company ________ a new branch in Tokyo, which ________ why she is traveling so much.", options: ["opens / is explaining", "is opening / explains", "opens / explains", "is opening / is explaining"], correctIndex: 1, hint: "Match the continuous form to the corporate project and the simple form to the logical conclusion.", explanation: "'Is opening' describes an active project in progress. 'Explains' is a factual, stative deduction." },
    { id: 30, examId: EXAM_ID_NEW, instruction: "Choose the correct verb forms to complete the sentence:", englishText: "Listen! The alarm ________! That ________ we need to evacuate the building immediately.", options: ["rings / is meaning", "is ringing / means", "rings / means", "is ringing / is meaning"], correctIndex: 1, hint: "The exclamation 'Listen!' implies an action happening right now. 'Mean' expresses a definition.", explanation: "The alarm 'is ringing' right now (dynamic), and 'means' signifies a static translation or consequence (stative)." }
];

async function main() {
    console.log("=== MULTI-EXAM MIGRATION SCRIPT ===\n");

    // Authenticate as teacher to get write permissions
    console.log("Authenticating as teacher...");
    await signInWithEmailAndPassword(auth, TEACHER_EMAIL, TEACHER_PASS);
    console.log("   Authenticated successfully.\n");

    // STEP 1: Tag existing questions with examId
    console.log("Step 1: Tagging existing questions...");
    const existingSnap = await getDocs(collection(db, 'preguntas'));
    let tagCount = 0;
    for (const docSnap of existingSnap.docs) {
        if (!docSnap.data().examId) {
            await updateDoc(doc(db, 'preguntas', docSnap.id), { examId: EXAM_ID_OLD });
            tagCount++;
        }
    }
    console.log(`   Tagged ${tagCount} existing questions with "${EXAM_ID_OLD}"`);

    // STEP 2: Upload new questions
    console.log("\nStep 2: Uploading 30 new questions...");
    for (const q of newQuestions) {
        const docId = `sppc-q${q.id.toString().padStart(2, '0')}`;
        await setDoc(doc(db, 'preguntas', docId), q);
    }
    console.log("   30 questions uploaded successfully.");

    // STEP 3: Create exam catalog
    console.log("\nStep 3: Creating exam catalog...");
    await setDoc(doc(db, 'examenes', EXAM_ID_OLD), {
        examId: EXAM_ID_OLD, title: 'English Grammar Exam',
        description: 'Comprehensive exam covering grammar fundamentals.',
        totalQuestions: existingSnap.size, createdAt: new Date().toISOString(), active: true, order: 1
    }, { merge: true });

    await setDoc(doc(db, 'examenes', EXAM_ID_NEW), {
        examId: EXAM_ID_NEW, title: 'Simple Present and Present Continuous',
        description: 'Advanced exam on stative vs. dynamic verbs, scheduled events, and temporary vs. permanent actions.',
        totalQuestions: 30, createdAt: new Date().toISOString(), active: true, order: 2
    }, { merge: true });
    console.log("   Exam catalog created.");

    // STEP 4: Verify
    const allQ = await getDocs(collection(db, 'preguntas'));
    const allE = await getDocs(collection(db, 'examenes'));
    console.log(`\nVerification: ${allQ.size} questions, ${allE.size} exams.`);
    allE.docs.forEach(d => console.log(`  - ${d.data().title}`));

    console.log("\n=== DONE. No data deleted. ===");
    process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
