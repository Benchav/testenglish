import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'grammar-exam-v3-pro';

// --- BASE DE DATOS DE PREGUNTAS (30 PREGUNTAS) ---
const questions = [
    // --- Parte 1: Gauntlet Nivel 1 (1-10) ---
    {
        id: 1,
        instruction: "Elige la descripción correcta para un escritorio con equipo y planos:",
        englishText: "An architect is looking at a blueprint. On the table, there is a large amount of equipment.",
        options: [
            "There are some equipment and a pencil on the table.",
            "There is a few equipments behind the blueprint.",
            "There is some equipment and many rolls of paper.",
            "There are much rolls of paper next to the pencil."
        ],
        correctIndex: 2,
        hint: "Identify which noun in the list is uncountable and check if the verb agrees with the first item mentioned."
    },
    {
        id: 2,
        instruction: "Reglas de seguridad en un laboratorio. Completa los espacios:",
        englishText: "Researchers _____ enter the bio-hazard room without a mask, but they _____ access the data from the computer outside.",
        options: ["can't / can", "can / can", "can / can't", "can't / can't"],
        correctIndex: 0,
        hint: "Look for the contrast between a dangerous restricted action and a safe allowed action."
    },
    {
        id: 3,
        instruction: "Estructura de un rascacielos. Completa con preposiciones:",
        englishText: "There is a helipad _____ the roof. The roof is _____ the 50th floor. The 49th floor is _____ the 50th floor.",
        options: ["on / above / under", "in / over / behind", "above / under / on", "on / between / above"],
        correctIndex: 0,
        hint: "Focus on the vertical relationship: which part is the surface and which parts are higher or lower."
    },
    {
        id: 4,
        instruction: "En el aeropuerto. ¿Cuál oración usa los cuantificadores correctamente?",
        englishText: "A traveler has two suitcases and a lot of luggage.",
        options: ["There are many luggages in the taxi.", "There is many luggage and two suitcases.", "There is much luggage and two suitcases.", "There are a luggage under the seat."],
        correctIndex: 2,
        hint: "Distinguish between the countable 'suitcases' and the uncountable 'luggage'."
    },
    {
        id: 5,
        instruction: "Multitud en un concierto. Selecciona las opciones correctas:",
        englishText: "The stage is _____ the crowd. There _____ thousands of people _____ the singer and me.",
        options: ["above / are / between", "under / is / among", "between / are / in front of", "above / is / next to"],
        correctIndex: 0,
        hint: "Check the vertical position of the stage and the plural agreement for the large number of people."
    },
    {
        id: 6,
        instruction: "¿Qué oración NO tiene errores gramaticales con verbos modales?",
        englishText: "A student is writing an essay about talent.",
        options: ["She can speaks three languages fluently.", "They can't to understand the difficult math problem.", "He can play the piano, but he can't read music.", "We can singing very loudly in the shower."],
        correctIndex: 2,
        hint: "Remember the 'Modal + Base Verb' rule: no 'to', no 's', and no '-ing'."
    },
    {
        id: 7,
        instruction: "Dentro de un cobertizo (shed). Completa correctamente:",
        englishText: "Inside, _____ some furniture and _____ many tools hanging _____ the wall.",
        options: ["there is / there are / on", "there are / there is / in", "there is / there is / above", "there are / there are / under"],
        correctIndex: 0,
        hint: "Treat 'furniture' as a single mass and 'tools' as individual items."
    },
    {
        id: 8,
        instruction: "Preguntando por ingredientes. ¿Cuál es correcta?",
        englishText: "Asking about the presence of a specific ingredient in a soup.",
        options: ["Are there any salt in the soup?", "Is there much carrots in the soup?", "Is there any salt in the soup?", "Are there much salt in the soup?"],
        correctIndex: 2,
        hint: "Determine if salt is something you can count piece by piece or if it is a mass."
    },
    {
        id: 9,
        instruction: "Capacidades de la oficina. Completa la oración:",
        englishText: "We _____ print 100 pages a minute, but there _____ not enough paper _____ the printer.",
        options: ["can / is / in", "can't / are / on", "can / are / under", "can't / is / behind"],
        correctIndex: 0,
        hint: "Check the agreement for 'paper' and the logical location of paper for a printer."
    },
    {
        id: 10,
        instruction: "Reto Lógico. Leche y galletas:",
        englishText: "There _____ some milk _____ the glass. You _____ drink it because it is fresh, but there _____ any cookies _____ the plate.",
        options: ["is / in / can / aren't / on", "are / on / can't / isn't / under", "is / under / can / is / in", "are / in / can / aren't / behind"],
        correctIndex: 0,
        hint: "Look closely at the plurality of 'cookies' versus the uncountability of 'milk'."
    },
    // --- Parte 2: Gauntlet Nivel 2 (11-30) ---
    {
        id: 11,
        instruction: "Un científico categoriza elementos. Completa la oración:",
        englishText: "There _____ a collection of rare bacteria in the jar, and there _____ much research data on the screen.",
        options: ["is / is", "are / are", "is / are", "are / is"],
        correctIndex: 0,
        hint: "Focus on whether the subject is the group itself ('collection') or the individual items."
    },
    {
        id: 12,
        instruction: "Un atleta habla de sus límites. Selecciona los modales y preposiciones:",
        englishText: "I _____ run a marathon today because of my injury, but I _____ still walk _____ the park for light exercise.",
        options: ["can't / can / through", "can / can't / across", "can't / can / on", "can / can / between"],
        correctIndex: 0,
        hint: "Consider how an injury affects a difficult task versus an easy one."
    },
    {
        id: 13,
        instruction: "Organizando una biblioteca. Completa con verbo y preposiciones:",
        englishText: "There _____ several pieces of furniture in the corner. _____ the armchair, there is a lamp. _____ the lamp, there is a small shelf.",
        options: ["are / Next to / Above", "is / Under / Behind", "are / In / On", "is / Beside / Below"],
        correctIndex: 0,
        hint: "Look at the word 'pieces' to determine the verb, then visualize the furniture layout."
    },
    {
        id: 14,
        instruction: "Un chef revisa ingredientes. ¿Cuál es la forma correcta?",
        englishText: "_____ there _____ advice you can give me? There _____ too much vinegar in the pot.",
        options: ["Is / any / is", "Are / some / are", "Is / many / is", "Are / any / is"],
        correctIndex: 0,
        hint: "Treat 'advice' like 'water'—you can't have 'three advices'."
    },
    {
        id: 15,
        instruction: "Un piloto explica la cabina. Ubicaciones exactas:",
        englishText: "The radar is _____ the control panel. _____ the pilot and co-pilot, there is a central console.",
        options: ["above / Between", "under / Among", "behind / On", "across / Next to"],
        correctIndex: 0,
        hint: "Think about the space shared by exactly two people."
    },
    {
        id: 16,
        instruction: "¿Qué oración sobre capacidad física y clima es gramaticalmente perfecta?",
        englishText: "(Selecciona la opción que no tenga errores de modales ni plurales)",
        options: ["We can't to go outside because there is much snow.", "We can go outside because there aren't many snow.", "We can't go outside because there is too much snow.", "We can goes outside because there is some snows."],
        correctIndex: 2,
        hint: "Watch out for the 'to' after modal verbs and the pluralization of uncountable weather terms."
    },
    {
        id: 17,
        instruction: "En una empresa de software:",
        englishText: "There _____ some sophisticated software available, but there _____ many instructions included.",
        options: ["is / aren't", "are / isn't", "is / isn't", "are / aren't"],
        correctIndex: 0,
        hint: "Software is like information—you can't count one 'software'."
    },
    {
        id: 18,
        instruction: "Describe la escena verticalmente:",
        englishText: "A bridge goes _____ the river. _____ the bridge, there is a car. _____ the water, there are many fish.",
        options: ["over / On / Under", "across / In / Above", "through / Under / In", "over / Behind / On"],
        correctIndex: 0,
        hint: "Visualize the vertical layers: the car, the bridge, and the river."
    },
    {
        id: 19,
        instruction: "Un estudiante pregunta a un profesor por material digital:",
        englishText: "_____ there any information about the exam? I _____ find it _____ the website.",
        options: ["Is / can't / on", "Are / can / in", "Is / can't / at", "Are / can't / on"],
        correctIndex: 0,
        hint: "Check the countability of 'information' and the preposition used for the internet."
    },
    {
        id: 20,
        instruction: "En un hotel de lujo lidiando con equipaje:",
        englishText: "There _____ a large amount of luggage in the lobby. You _____ leave it _____ the reception desk.",
        options: ["is / can / at", "are / can't / in", "is / can / between", "are / can / on"],
        correctIndex: 0,
        hint: "Think about whether luggage is treated as a mass or as individual bags."
    },
    {
        id: 21,
        instruction: "En el zoológico viendo animales:",
        englishText: "_____ there many monkeys in that cage? Yes, and they _____ climb _____ the trees very quickly.",
        options: ["Are / can / up", "Is / can't / in", "Are / can / under", "Is / can / on"],
        correctIndex: 0,
        hint: "Ensure the verb matches the plural noun and the preposition matches the action."
    },
    {
        id: 22,
        instruction: "Revisa esta oración: 'There is a lot of homework, so I can't play today.'",
        englishText: "¿Cuál es la afirmación correcta sobre la oración anterior?",
        options: ["La oración está perfecta.", "Debería ser 'There are a lot of homeworks'.", "Debería ser 'I can't to play'.", "Debería ser 'There are much homework'."],
        correctIndex: 0,
        hint: "Consider if 'homework' can be pluralized like 'books'."
    },
    {
        id: 23,
        instruction: "Un guía describe la vista desde una montaña:",
        englishText: "There _____ a few clouds _____ the summit. You _____ see the view clearly if they move.",
        options: ["are / above / can", "is / on / can't", "are / under / can't", "is / above / can"],
        correctIndex: 0,
        hint: "Agreement with 'clouds' and the logic of visibility are key here."
    },
    {
        id: 24,
        instruction: "En la mesa de un restaurante:",
        englishText: "Is there _____ sugar in this coffee? No, but there _____ some packets of sugar _____ the table.",
        options: ["any / are / on", "some / is / in", "many / are / at", "any / is / on"],
        correctIndex: 0,
        hint: "Distinguish between the substance (sugar) and the container (packets)."
    },
    {
        id: 25,
        instruction: "En clase de física sobre fuerzas invisibles:",
        englishText: "Gravity _____ be seen, but there _____ many ways to measure its force.",
        options: ["can't / are", "can / is", "can't / is", "can / are"],
        correctIndex: 0,
        hint: "Think about whether you can see the force of gravity or just its effects."
    },
    {
        id: 26,
        instruction: "Un gerente de almacén reporta sobre retrasos:",
        englishText: "There _____ a lot of traffic _____ the building today. Our trucks _____ move very quickly.",
        options: ["is / around / can't", "are / between / can", "is / in / can", "are / through / can't"],
        correctIndex: 0,
        hint: "Consider how traffic affects speed and the countability of the word 'traffic'."
    },
    {
        id: 27,
        instruction: "En un viaje de senderismo cuidando la naturaleza:",
        englishText: "There _____ some trash _____ the path. We _____ pick it up to keep the forest clean.",
        options: ["is / along / can", "are / on / can't", "is / behind / can't", "are / beside / can"],
        correctIndex: 0,
        hint: "Is 'trash' like 'bottles' (countable) or like 'water' (uncountable)?"
    },
    {
        id: 28,
        instruction: "En un laboratorio de biología discutiendo hallazgos:",
        englishText: "_____ there any news about the experiment? Yes, there _____ some interesting evidence _____ the microscopic slides.",
        options: ["Is / is / on", "Are / are / in", "Is / are / on", "Are / is / at"],
        correctIndex: 0,
        hint: "Don't let the 's' in 'news' trick you into thinking it's plural."
    },
    {
        id: 29,
        instruction: "Un jugador de videojuegos está frustrado:",
        englishText: "There _____ many enemies _____ the corner. I _____ see them, so I _____ win this level!",
        options: ["are / around / can't / can't", "is / on / can / can", "are / at / can't / can", "is / behind / can / can't"],
        correctIndex: 0,
        hint: "Check the agreement for 'enemies' and follow the sequence of the player's problem."
    },
    {
        id: 30,
        instruction: "Maestría Final: Espacio y obstáculos:",
        englishText: "_____ there much space _____ the trunk of the car? No, there _____ several heavy boxes _____ the way.",
        options: ["Is / in / are / in", "Are / at / is / on", "Is / on / are / behind", "Are / in / are / in"],
        correctIndex: 0,
        hint: "Determine the countability of 'space' versus 'boxes' and the meaning of being 'in the way'."
    }
];

const optionLetters = ['A', 'B', 'C', 'D'];

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoaded, setAuthLoaded] = useState(false);

    // Estado de Navegación: 'start', 'quiz', 'result', 'teacher_login', 'dashboard'
    const [view, setView] = useState('start');

    // Datos del estudiante y progreso del Quiz
    const [studentName, setStudentName] = useState('');
    const [answers, setAnswers] = useState(Array(questions.length).fill(null));
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isAnswered, setIsAnswered] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Contadores en vivo
    const [correctCount, setCorrectCount] = useState(0);
    const [incorrectCount, setIncorrectCount] = useState(0);

    // Datos del Dashboard
    const [resultsData, setResultsData] = useState([]);
    const [pinInput, setPinInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // 1. Inicializar Autenticación
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (err) {
                console.error("Error Auth:", err);
            }
        };
        initAuth();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    // 2. Dashboard Snapshot
    useEffect(() => {
        if (!user || view !== 'dashboard') return;
        const resultsRef = collection(db, 'artifacts', appId, 'public', 'data', 'examResults');
        const unsubscribe = onSnapshot(resultsRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setResultsData(data);
        });
        return () => unsubscribe();
    }, [user, view]);

    // Manejadores del Examen
    const handleStartQuiz = () => {
        if (studentName.trim() === '') {
            setErrorMsg("Ingresa tu nombre para comenzar.");
            return;
        }
        setErrorMsg('');
        setAnswers(Array(questions.length).fill(null));
        setCurrentQuestionIndex(0);
        setCorrectCount(0);
        setIncorrectCount(0);
        setIsAnswered(false);
        setShowHint(false);
        setView('quiz');
    };

    const handleSelectOption = (index) => {
        if (isAnswered) return; // Evita cambiar la respuesta una vez seleccionada

        const isCorrect = index === questions[currentQuestionIndex].correctIndex;

        // Actualizar contadores
        if (isCorrect) setCorrectCount(prev => prev + 1);
        else setIncorrectCount(prev => prev + 1);

        // Guardar respuesta
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = index;
        setAnswers(newAnswers);
        setIsAnswered(true);
    };

    const handleNextQuestion = async () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setIsAnswered(false);
            setShowHint(false);
        } else {
            // Finalizar Examen
            try {
                const resultsRef = collection(db, 'artifacts', appId, 'public', 'data', 'examResults');
                await addDoc(resultsRef, {
                    studentName,
                    score: correctCount,
                    total: questions.length,
                    answers: answers,
                    timestamp: new Date().toISOString(),
                    userId: user.uid
                });
                setView('result');
            } catch (err) {
                console.error("Error saving:", err);
            }
        }
    };

    // Manejadores del Profesor
    const handleTeacherLogin = () => {
        if (pinInput === '1234') {
            setView('dashboard');
            setErrorMsg('');
            setPinInput('');
        } else {
            setErrorMsg('PIN incorrecto.');
        }
    };

    if (!authLoaded) return <div className="flex h-screen items-center justify-center bg-gray-50"><p>Cargando...</p></div>;

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans p-4 md:p-8">
            <div className="max-w-3xl mx-auto">

                {/* --- INICIO --- */}
                {view === 'start' && (
                    <div className="p-8 rounded-2xl shadow-sm border mt-10">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Examen Final de Gramática</h1>
                        <p className="text-gray-500 mb-8 text-center">30 Preguntas • Nivel Avanzado</p>

                        <div className="space-y-4 max-w-sm mx-auto">
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Tu Nombre Completo"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            {errorMsg && <p className="text-red-500 text-sm text-center">{errorMsg}</p>}
                            <button
                                onClick={handleStartQuiz}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                            >
                                Comenzar Examen
                            </button>
                        </div>
                        <div className="mt-8 text-center pt-6">
                            <button onClick={() => setView('teacher_login')} className="text-sm text-gray-400 hover:text-gray-600">
                                Acceso Profesor
                            </button>
                        </div>
                    </div>
                )}

                {/* --- LOGIN PROFESOR --- */}
                {view === 'teacher_login' && (
                    <div className="p-8 rounded-2xl shadow-sm border mt-10 max-w-sm mx-auto">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">Panel del Profesor</h2>
                        <div className="space-y-4">
                            <input
                                type="password"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                placeholder="PIN"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none"
                            />
                            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
                            <button onClick={handleTeacherLogin} className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg">Entrar</button>
                            <button onClick={() => setView('start')} className="w-full bg-gray-100 py-2 rounded-lg text-sm">Cancelar</button>
                        </div>
                    </div>
                )}

                {/* --- QUIZ UI (REPLICA DE LA IMAGEN) --- */}
                {view === 'quiz' && (
                    <div className="flex flex-col h-[calc(100vh-40px)] max-h-[800px]">
                        {/* Barra superior estilo Google Gemini */}
                        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white py-2 z-10">
                            <div className="flex-1 flex items-center mr-4">
                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mr-3">
                                    <div
                                        className="bg-blue-600 h-full transition-all duration-300 ease-out"
                                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                                    {currentQuestionIndex + 1} / {questions.length}
                                </span>
                            </div>

                            {/* Contadores Correcto/Incorrecto */}
                            <div className="flex space-x-2">
                                <div className="flex items-center space-x-1 bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm font-bold border border-red-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    <span>{incorrectCount}</span>
                                </div>
                                <div className="flex items-center space-x-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-sm font-bold border border-green-100">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    <span>{correctCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Contenido de la Pregunta */}
                        <div className="flex-1 overflow-y-auto pb-24">
                            <div className="mb-6">
                                <p className="text-sm text-gray-500 mb-2">{questions[currentQuestionIndex].instruction}</p>
                                <p className="text-lg font-medium text-gray-900 leading-relaxed">
                                    {questions[currentQuestionIndex].englishText}
                                </p>
                            </div>

                            {/* Opciones */}
                            <div className="space-y-3 mb-6">
                                {questions[currentQuestionIndex].options.map((opt, idx) => {
                                    const isSelected = answers[currentQuestionIndex] === idx;
                                    const isCorrectAnswer = questions[currentQuestionIndex].correctIndex === idx;

                                    // Estilos condicionales basados en si ya se respondió
                                    let optionClass = "bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200";

                                    if (isAnswered) {
                                        if (isCorrectAnswer) {
                                            optionClass = "bg-green-100 border-green-400 text-green-900 shadow-sm";
                                        } else if (isSelected && !isCorrectAnswer) {
                                            optionClass = "bg-red-100 border-red-400 text-red-900 shadow-sm";
                                        } else {
                                            optionClass = "bg-gray-50 text-gray-400 opacity-60 border-transparent";
                                        }
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectOption(idx)}
                                            disabled={isAnswered}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start ${optionClass}`}
                                        >
                                            <span className="font-bold mr-3">{optionLetters[idx]}.</span>
                                            <span className="flex-1 leading-snug">{opt}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Acordeón "Mostrar pista" */}
                            <div className="border-t pt-4">
                                <button
                                    onClick={() => setShowHint(!showHint)}
                                    className="flex items-center text-gray-700 font-medium hover:text-gray-900 focus:outline-none"
                                >
                                    Mostrar pista
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18" height="18"
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        className={`ml-1 transition-transform ${showHint ? 'rotate-180' : ''}`}
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                {showHint && (
                                    <div className="mt-4 bg-gray-50 p-4 rounded-xl flex items-start text-gray-700 text-sm border">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-3 mt-0.5 text-gray-500 shrink-0">
                                            <line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>
                                        </svg>
                                        <p>{questions[currentQuestionIndex].hint}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Botón Siguiente (Fijo abajo) */}
                        <div className="bg-white py-4 border-t flex justify-end">
                            <button
                                onClick={handleNextQuestion}
                                disabled={!isAnswered}
                                className={`px-8 py-3 rounded-full font-bold transition-all ${isAnswered
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {currentQuestionIndex === questions.length - 1 ? "Finalizar" : "Siguiente"}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- PANTALLA RESULTADO --- */}
                {view === 'result' && (
                    <div className="p-8 rounded-2xl shadow-sm border mt-10 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Completado!</h2>
                        <p className="text-gray-500 mb-6">Respuestas registradas exitosamente.</p>
                        <div className="text-6xl font-black text-blue-600 mb-2">{score} <span className="text-2xl text-gray-400">/ {questions.length}</span></div>
                        <p className="mb-8 font-medium">Porcentaje de acierto: {Math.round((score / questions.length) * 100)}%</p>
                        <button onClick={() => setView('start')} className="bg-gray-800 text-white px-6 py-2 rounded-lg">Volver al Inicio</button>
                    </div>
                )}

                {/* --- DASHBOARD DEL PROFESOR --- */}
                {view === 'dashboard' && (
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mt-6">
                        <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                            <h2 className="text-lg font-bold">Resultados (30 Preguntas)</h2>
                            <button onClick={() => setView('start')} className="text-xs bg-gray-700 px-3 py-1 rounded">Cerrar Sesión</button>
                        </div>
                        <div className="p-4">
                            {resultsData.length === 0 ? (
                                <p className="text-center text-gray-500 py-6">Sin resultados aún.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-600 border-b text-sm">
                                                <th className="p-3">Estudiante</th>
                                                <th className="p-3">Puntuación</th>
                                                <th className="p-3">%</th>
                                                <th className="p-3">Detalle (1-30)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultsData.map((result) => (
                                                <tr key={result.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 font-medium">{result.studentName}</td>
                                                    <td className="p-3 font-bold">{result.score}/{result.total}</td>
                                                    <td className="p-3">{Math.round((result.score / result.total) * 100)}%</td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1 w-64">
                                                            {result.answers.map((ans, i) => {
                                                                const isCorrect = ans === questions[i].correctIndex;
                                                                return (
                                                                    <span key={i} className={`w-4 h-4 rounded-full inline-block ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} title={`Pregunta ${i + 1}`}></span>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}