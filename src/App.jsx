import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

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

const optionLetters = ['A', 'B', 'C', 'D'];

export default function App() {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'estudiante' | 'docente'
    const [authLoaded, setAuthLoaded] = useState(false);
    
    // Auth UI State
    const [emailStr, setEmailStr] = useState('');
    const [passStr, setPassStr] = useState('');
    const [nameStr, setNameStr] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    // Estado principal de navegación
    const [view, setView] = useState('auth'); // 'auth' | 'start' | 'quiz' | 'result' | 'dashboard'

    // Datos del Quiz (dinámicos)
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isAnswered, setIsAnswered] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Contadores
    const [correctCount, setCorrectCount] = useState(0);
    const [incorrectCount, setIncorrectCount] = useState(0);

    // Dashboard
    const [resultsData, setResultsData] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    // 1. Efecto de Escucha de Autenticación y Rol
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Verificar Rol en DB
                try {
                    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
                    if (userDoc.exists()) {
                        const rol = userDoc.data().rol;
                        setUserRole(rol);
                        setView(rol === 'docente' ? 'dashboard' : 'start');
                        if (rol === 'estudiante') setNameStr(userDoc.data().nombre || currentUser.email);
                    } else {
                        // Si no existe, forzamos rol estudiante (fue creado directo pero sin doc)
                        await setDoc(doc(db, "usuarios", currentUser.uid), {
                            email: currentUser.email,
                            rol: 'estudiante',
                            nombre: currentUser.displayName || currentUser.email,
                            createdAt: new Date().toISOString()
                        });
                        setUserRole('estudiante');
                        setView('start');
                    }
                } catch(e) {
                    console.error("Error al leer rol:", e);
                    setUserRole('estudiante');
                    setView('start');
                }
            } else {
                setUserRole(null);
                setView('auth');
            }
            setAuthLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    // 2. Efecto Cargar Preguntas o Dashboard según el rol
    useEffect(() => {
        if (!user || !userRole) return;
        
        if (userRole === 'estudiante') {
            // Cargar preguntas para estudiante
            const qRef = collection(db, 'preguntas');
            const unsub = onSnapshot(qRef, (snapshot) => {
                const loaded = snapshot.docs.map(doc => ({ fbId: doc.id, ...doc.data() }));
                // Opcional: ordenar si hace falta
                loaded.sort((a,b) => a.id - b.id);
                setQuestions(loaded);
            });
            return () => unsub();
        } else if (userRole === 'docente' && view === 'dashboard') {
            // Cargar dashboard para docente
            const rRef = query(collection(db, 'calificaciones'), orderBy('timestamp', 'desc'));
            const unsub = onSnapshot(rRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setResultsData(data);
            });
            return () => unsub();
        }
    }, [user, userRole, view]);

    // MANEJADORES DE AUTH
    const handleAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isRegistering) {
                if(!nameStr.trim()) return setErrorMsg('Por favor ingresa tu nombre');
                const cred = await createUserWithEmailAndPassword(auth, emailStr, passStr);
                // Crear perfil de estudiante base
                await setDoc(doc(db, "usuarios", cred.user.uid), {
                    email: emailStr,
                    rol: 'estudiante',
                    nombre: nameStr,
                    createdAt: new Date().toISOString()
                });
            } else {
                await signInWithEmailAndPassword(auth, emailStr, passStr);
            }
        } catch (error) {
            console.error(error);
            setErrorMsg(error.message);
        }
    };

    const handleLogout = () => {
        signOut(auth);
    };

    // MANEJADORES DEL EXAMEN
    const handleStartQuiz = () => {
        if(questions.length === 0) {
            setErrorMsg('Cargando preguntas de la nube... intenta en un segundo.');
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
        if (isAnswered) return; 
        const isCorrect = index === questions[currentQuestionIndex].correctIndex;
        if (isCorrect) setCorrectCount(prev => prev + 1);
        else setIncorrectCount(prev => prev + 1);

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
            // Termina Examen y Guarda en Calificaciones Privadas
            try {
                const resultsRef = collection(db, 'calificaciones');
                await addDoc(resultsRef, {
                    uid: user.uid,
                    studentName: nameStr || user.email,
                    score: correctCount,
                    total: questions.length,
                    answers: answers,
                    timestamp: new Date().toISOString(),
                });
                setView('result');
            } catch (err) {
                console.error("Error saving:", err);
                setErrorMsg('Error al guardar resultado: Verifica permisos Firestore.');
            }
        }
    };

    if (!authLoaded) return <div className="flex justify-center items-center h-screen">Cargando Sistema...</div>;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-end mb-4">
                    {user && (
                         <button onClick={handleLogout} className="text-gray-500 hover:text-black font-semibold text-sm mr-2 flex items-center">
                            <span className="mr-2">({user.email} - {userRole})</span> Salir
                         </button>
                    )}
                </div>

                {/* --- AUTENTICACIÓN --- */}
                {view === 'auth' && (
                    <div className="bg-white p-8 rounded-2xl shadow border max-w-sm mx-auto mt-12">
                        <h1 className="text-2xl font-bold mb-6 text-center">Plataforma Examen</h1>
                        <form onSubmit={handleAuth} className="space-y-4">
                            {isRegistering && (
                                <input type="text" placeholder="Tu Nombre Completo" value={nameStr} onChange={(e) => setNameStr(e.target.value)} required className="w-full px-4 py-2 border rounded-xl" />
                            )}
                            <input type="email" placeholder="Correo Electrónico" value={emailStr} onChange={(e) => setEmailStr(e.target.value)} required className="w-full px-4 py-2 border rounded-xl" />
                            <input type="password" placeholder="Contraseña" value={passStr} onChange={(e) => setPassStr(e.target.value)} required className="w-full px-4 py-2 border rounded-xl" />
                            
                            {errorMsg && <p className="text-red-500 text-xs mt-1 text-center font-semibold">{errorMsg}</p>}
                            
                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700">
                                {isRegistering ? 'Registrarse' : 'Ingresar'}
                            </button>
                        </form>
                        <div className="text-center mt-6 text-sm">
                            <button onClick={() => setIsRegistering(!isRegistering)} className="text-blue-500 underline">
                                {isRegistering ? '¿Ya tienes cuenta? Ingresa' : '¿Eres un alumno nuevo? Regístrate'}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- START DOCENTE --- */}
                {view === 'start' && userRole === 'docente' && (
                    <div className="text-center mt-12">
                         <h2 className="text-xl">Redirigiendo a Panel Docente...</h2>
                         {setView('dashboard')}
                    </div>
                )}

                {/* --- START (ESTUDIANTE) --- */}
                {view === 'start' && userRole === 'estudiante' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border mt-10 text-center">
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Examen de Gramática</h1>
                        <p className="text-gray-500 mb-8">Nivel Avanzado - Evaluando desde la Nube</p>
                        <p className="font-semibold text-lg mb-4 text-blue-600">Bienvenid@, {nameStr}</p>
                        
                        {errorMsg && <p className="text-red-500 mb-2 font-bold">{errorMsg}</p>}
                        <button onClick={handleStartQuiz} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg">
                            Comenzar Prueba ({questions.length} Preguntas)
                        </button>
                    </div>
                )}

                {/* --- MÓDULO DE PREGUNTAS --- */}
                {view === 'quiz' && questions.length > 0 && (
                    <div className="flex flex-col h-[calc(100vh-40px)] max-h-[800px] bg-white rounded-2xl shadow-lg border p-1 md:p-6">
                        {/* Header Progreso */}
                        <div className="flex items-center justify-between mb-6 sticky top-0 py-2 z-10">
                            <div className="flex-1 mr-4">
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div className="bg-blue-600 h-full transition-all" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
                                </div>
                                <span className="text-xs text-gray-500 font-bold block mt-1">Pregunta {currentQuestionIndex + 1} de {questions.length}</span>
                            </div>
                            <div className="flex space-x-2">
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm">✓ {correctCount}</span>
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm">✗ {incorrectCount}</span>
                            </div>
                        </div>

                        {/* Pregunta */}
                        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2">
                            <div className="mb-6">
                                <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">{questions[currentQuestionIndex].instruction}</p>
                                <p className="text-xl font-medium text-gray-900 leading-relaxed font-serif">
                                    {questions[currentQuestionIndex].englishText}
                                </p>
                            </div>

                            {/* Opciones */}
                            <div className="space-y-3">
                                {questions[currentQuestionIndex].options.map((opt, idx) => {
                                    const isSelected = answers[currentQuestionIndex] === idx;
                                    const isCorrect = questions[currentQuestionIndex].correctIndex === idx;
                                    
                                    let cls = "bg-gray-50 border-gray-200 hover:bg-gray-100";
                                    if (isAnswered) {
                                        if (isCorrect) cls = "bg-green-50 border-green-400 text-green-900";
                                        else if (isSelected) cls = "bg-red-50 border-red-400 text-red-900";
                                        else cls = "bg-gray-50 opacity-50";
                                    }

                                    return (
                                        <button key={idx} onClick={() => handleSelectOption(idx)} disabled={isAnswered}
                                            className={`w-full text-left p-4 rounded-xl border-2 font-medium flex items-start transition-colors ${cls}`}>
                                            <span className="font-bold mr-3">{optionLetters[idx]}.</span>
                                            <span>{opt}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-6 border-t pt-4">
                                <button onClick={() => setShowHint(!showHint)} className="text-sm text-gray-500 font-bold hover:text-black">Mostrar Pista</button>
                                {showHint && <p className="mt-2 text-sm bg-blue-50 p-3 rounded-lg text-blue-900">* {questions[currentQuestionIndex].hint}</p>}
                            </div>
                        </div>

                        {errorMsg && <p className="text-red-500 font-bold mb-2 text-center">{errorMsg}</p>}
                        
                        <div className="border-t pt-4 flex justify-end">
                            <button onClick={handleNextQuestion} disabled={!isAnswered}
                                className={`px-8 py-3 rounded-xl font-bold transition-all ${isAnswered ? 'bg-blue-600 hover:bg-blue-700 text-white shadow' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                {currentQuestionIndex === questions.length - 1 ? "Finalizar" : "Siguiente"}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- PANTALLA RESULTADO --- */}
                {view === 'result' && (
                    <div className="bg-white p-8 rounded-2xl shadow border mx-auto mt-10 text-center">
                        <h2 className="text-3xl font-extrabold text-gray-800 mb-2">¡Misión Cumplida!</h2>
                        <p className="text-gray-500 mb-6">Tu resultado ha sido enviado a la plataforma central de forma segura.</p>
                        <div className="text-6xl font-black text-blue-600 mb-2">{correctCount} <span className="text-3xl text-gray-400">/ {questions.length}</span></div>
                        <p className="mb-6 font-bold text-gray-600">{(correctCount / questions.length * 100).toFixed(0)}% de acierto</p>
                        <button onClick={() => setView('start')} className="bg-gray-800 text-white px-6 py-3 font-semibold rounded-xl w-full max-w-xs shadow">Cerrar Examen</button>
                    </div>
                )}

                {/* --- PANEL DOCENTE --- */}
                {view === 'dashboard' && userRole === 'docente' && (
                    <div className="bg-white rounded-2xl shadow-xl border overflow-hidden mt-6">
                        <div className="bg-gray-900 text-white p-6 flex justify-between items-center border-b">
                            <div>
                                <h2 className="text-2xl font-bold">Panel de Docentes</h2>
                                <p className="text-gray-400 text-sm">Control e Integridad en la Nube</p>
                            </div>
                            <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Modo Segura</span>
                        </div>
                        <div className="p-0">
                            {resultsData.length === 0 ? (
                                <p className="text-center text-gray-500 py-12 text-lg">No hay calificaciones registradas aún.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left bg-white text-sm">
                                        <thead className="bg-gray-50 text-gray-600">
                                            <tr>
                                                <th className="p-4 border-b font-semibold">Estudiante</th>
                                                <th className="p-4 border-b font-semibold">Puntuación</th>
                                                <th className="p-4 border-b font-semibold">Detalle Respuestas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {resultsData.map((res) => (
                                                <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-medium text-gray-900">
                                                        {res.studentName} <br/><span className="text-xs text-gray-400 font-normal">{new Date(res.timestamp).toLocaleDateString()}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded font-bold ${res.score >= 18 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                            {res.score}/{res.total}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-1 max-w-sm">
                                                            {res.answers.map((ans, i) => {
                                                                const isCorr = ans === questions[i]?.correctIndex; 
                                                                return (
                                                                    <div key={i} className={`w-3 h-3 rounded-full ${isCorr ? 'bg-green-500' : 'bg-red-500'} shadow-sm`} title={`P${i+1}`}></div>
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