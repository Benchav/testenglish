import React, { useState, useEffect, useCallback, memo } from 'react';
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

const EdTechButton = memo(function EdTechButton({ onClick, children, disabled, className = '', ghost = false }) {
    let baseClass = "px-8 py-3.5 rounded-full font-bold tracking-wide transition-all duration-300 transform active:scale-95 outline-none flex justify-center items-center ";

    if (disabled) {
        baseClass += "bg-gray-200 text-gray-400 cursor-not-allowed ";
    } else if (ghost) {
        baseClass += "bg-white text-blue-600 border-2 border-blue-100 hover:bg-blue-50 shadow-sm ";
    } else {
        baseClass += "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/40 hover:shadow-blue-500/60 hover:-translate-y-0.5 ";
    }

    return (
        <button onClick={onClick} disabled={disabled} className={`${baseClass} ${className}`}>
            {children}
        </button>
    );
});

const EdTechInput = memo(function EdTechInput({ type, placeholder, value, onChange, required }) {
    return (
    <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full bg-[#f8fafc] text-[#1e293b] border border-[#e2e8f0] rounded-2xl px-5 py-4 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none placeholder-[#64748b]"
    />
    );
});

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
    const [view, setView] = useState('auth'); 

    // Datos del Quiz
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

    const handleNameChange = useCallback((e) => setNameStr(e.target.value), []);
    const handleEmailChange = useCallback((e) => setEmailStr(e.target.value), []);
    const handlePasswordChange = useCallback((e) => setPassStr(e.target.value), []);
    const handleToggleRegister = useCallback((e) => {
        e.preventDefault();
        setIsRegistering(prev => !prev);
        setErrorMsg('');
    }, []);

    // --- EFECTOS ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
                    if (userDoc.exists()) {
                        const rol = userDoc.data().rol;
                        setUserRole(rol);
                        setView(rol === 'docente' ? 'dashboard' : 'start');
                        if (rol === 'estudiante') setNameStr(userDoc.data().nombre || currentUser.email);
                    } else {
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
                    console.error("Error reading user role:", e);
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

    useEffect(() => {
        if (!user || !userRole) return;
        
        if (userRole === 'estudiante') {
            const qRef = collection(db, 'preguntas');
            const unsub = onSnapshot(qRef, (snapshot) => {
                const loaded = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const correctString = data.options[data.correctIndex]; 
                    const shuffledOptions = [...data.options].sort(() => Math.random() - 0.5);
                    const newCorrectIndex = shuffledOptions.indexOf(correctString);

                    return { 
                        fbId: doc.id, 
                        ...data, 
                        options: shuffledOptions,
                        shuffledCorrectIndex: newCorrectIndex
                    };
                });
                loaded.sort((a,b) => a.id - b.id);
                setQuestions(loaded);
            });
            return () => unsub();
        } else if (userRole === 'docente' && view === 'dashboard') {
            const rRef = query(collection(db, 'calificaciones'), orderBy('timestamp', 'desc'));
            const unsub = onSnapshot(rRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setResultsData(data);
            });
            return () => unsub();
        }
    }, [user, userRole, view]);

    // --- MANEJADORES ---
    const handleAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isRegistering) {
                if(!nameStr.trim()) return setErrorMsg('Please enter your name.');
                const cred = await createUserWithEmailAndPassword(auth, emailStr, passStr);
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
            setErrorMsg('Invalid credentials. Please check your email and password.');
        }
    };

    const handleLogout = () => signOut(auth);

    const handleStartQuiz = () => {
        if(questions.length === 0) {
            setErrorMsg('Questions are still syncing. Please try again in a few seconds.');
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
        const isCorrect = index === questions[currentQuestionIndex].shuffledCorrectIndex;
        if (isCorrect) setCorrectCount(prev => prev + 1);
        else setIncorrectCount(prev => prev + 1);

        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = { indexClicked: index, isCorrect: isCorrect };
        setAnswers(newAnswers);
        setIsAnswered(true);
    };

    const handleNextQuestion = async () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setIsAnswered(false);
            setShowHint(false);
        } else {
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
                setErrorMsg('Connection error while saving your score.');
            }
        }
    };

    // --- RENDERIZADO PRINCIPAL ---
    if (!authLoaded) return <div className="flex justify-center items-center h-screen bg-[#f4f7fe] text-[#64748b] font-medium animate-pulse">Loading Teacher Elimar Roa English Exam...</div>;

    // Métricas totales globales (Para Panel Docente)
    const totalAttempted = resultsData.length;
    let globalAcc = 0;
    if (totalAttempted > 0) {
        const totalScore = resultsData.reduce((acc, curr) => acc + curr.score, 0);
        const maxScore = resultsData.reduce((acc, curr) => acc + curr.total, 0);
        globalAcc = ((totalScore / maxScore) * 100).toFixed(0);
    }

    return (
        <div className="min-h-screen bg-[#f4f7fe] text-[#1e293b] font-sans antialiased overflow-x-hidden relative">
            
            {/* Header Gradiente Gigante que cruza la app si está logueado */}
            {user && (
                <div className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 pb-28 pt-8 px-6 lg:px-12 rounded-b-[2rem] shadow-sm relative z-0">
                    <div className="max-w-5xl mx-auto flex justify-between items-start">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-inner">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-white">
                                <h1 className="text-2xl font-bold tracking-tight">Hi, {nameStr || user.email.split('@')[0]}</h1>
                                <p className="text-blue-100 font-medium opacity-90">
                                    {userRole === 'docente' ? 'Teacher Results Panel' : 'English Exam Home'}
                                </p>
                            </div>
                        </div>
                        {view !== 'quiz' && (
                            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/25 backdrop-blur-sm transition-colors rounded-full p-3 text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 w-full relative z-10 flex flex-col items-center">
                
                {/* --- MÓDULO AUTH (SaaS Premium Split Layout) --- */}
                {view === 'auth' && (
                    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(37,99,235,0.15)] w-full max-w-4xl flex overflow-hidden mt-8 md:mt-16 transform transition-all border border-slate-100">
                        
                        {/* Lado Gráfico (Panel Izquierdo - Oculto en móvil) */}
                        <div className="hidden md:flex w-[45%] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-12 flex-col justify-center items-center relative overflow-hidden text-center">
                            {/* Decorative blur elements para SaaS look */}
                            <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-800 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                            
                            <img src="/edtech-bg.png" alt="English exam" className="w-[85%] h-auto object-contain drop-shadow-2xl z-10 mb-10 transform hover:scale-105 transition-transform duration-700 ease-out" onError={(e) => e.target.style.display = 'none'} />
                            
                            <h2 className="text-white text-3xl font-black tracking-tight leading-tight z-10">English Grammar Exam</h2>
                            <p className="text-blue-100 mt-5 text-[15px] font-medium z-10 max-w-[250px]">Official exam by Teacher Elimar Roa. Read each question carefully and choose the best answer.</p>
                        </div>

                        {/* Lado Formulario (Panel Derecho) */}
                        <div className="w-full md:w-[55%] p-10 sm:p-14 lg:p-16 flex flex-col justify-center bg-white relative">
                            <div className="mb-10 text-center md:text-left">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[1rem] flex items-center justify-center mb-6 shadow-inner mx-auto md:mx-0">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <h3 className="text-3xl font-extrabold text-[#1e293b] tracking-tight">
                                    {isRegistering ? 'Create Student Account' : 'Welcome to the Exam'}
                                </h3>
                                <p className="text-slate-500 mt-2.5 text-[15px] font-medium">
                                    {isRegistering ? 'Create your account to take Teacher Elimar Roa\'s exam.' : 'Sign in to continue your English exam.'}
                                </p>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-5">
                                {isRegistering && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <EdTechInput type="text" placeholder="e.g. John Doe" value={nameStr} onChange={handleNameChange} required />
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <EdTechInput type="email" placeholder="studentname@gmail.com" value={emailStr} onChange={handleEmailChange} required />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Password</label>
                                        {!isRegistering && <span className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 cursor-pointer">Forgot?</span>}
                                    </div>
                                    <EdTechInput type="password" placeholder="••••••••" value={passStr} onChange={handlePasswordChange} required />
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-50 text-red-600 text-[13px] font-bold p-4 rounded-2xl border border-red-100 flex items-start">
                                        <svg className="w-5 h-5 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <div className="pt-4">
                                    <EdTechButton className="w-full py-[1.15rem] text-[16px] shadow-blue-500/25">
                                        {isRegistering ? 'Create Account' : 'Sign In'}
                                    </EdTechButton>
                                </div>
                            </form>

                            <div className="mt-8 text-center md:text-left">
                                <p className="text-slate-500 text-[14px] font-medium">
                                    {isRegistering ? 'Already registered? ' : 'Need an account for this exam? '}
                                    <button onClick={handleToggleRegister} className="text-blue-600 font-extrabold hover:text-blue-800 transition-colors">
                                        {isRegistering ? 'Sign In' : 'Create Account'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO INICIO ESTUDIANTE --- */}
                {view === 'start' && userRole === 'estudiante' && (
                    <div className="w-full bg-white p-8 md:p-12 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] -mt-16 text-center">
                        <div className="bg-blue-50/50 rounded-3xl p-8 mb-8 inline-block">
                            <img src="/edtech-bg.png" alt="English exam preparation" className="h-48 mx-auto hover:scale-105 transition-transform" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-[#1e293b] mb-4">Are you ready for Teacher Elimar Roa's English Exam?</h2>
                        <p className="text-[#64748b] text-[17px] mb-10 max-w-md mx-auto font-medium">
                            This exam has 30 questions. Choose one answer per question. Your score will be saved at the end.
                        </p>
                        
                        {errorMsg && <p className="text-red-500 mb-6 font-bold bg-red-50 py-3 rounded-xl max-w-sm mx-auto">{errorMsg}</p>}
                        
                        <div className="flex justify-center">
                            <EdTechButton onClick={handleStartQuiz} className="text-lg w-full max-w-[300px]">
                                Start Exam
                            </EdTechButton>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO EXAMEN --- */}
                {view === 'quiz' && questions.length > 0 && (
                    <div className="w-full max-w-3xl -mt-14">
                        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] p-6 md:p-10 mb-8 border border-slate-100">
                            
                            {/* Header de Pregunta Círculos */}
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl mb-8">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mr-4 shadow-inner">
                                        Q{currentQuestionIndex + 1}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Progress</div>
                                        <div className="font-extrabold text-slate-800">{currentQuestionIndex + 1} / {questions.length}</div>
                                    </div>
                                </div>
                                <div className="bg-white px-5 py-2.5 rounded-full shadow-sm font-bold text-[#1e293b] flex space-x-4 border border-slate-100">
                                    <span className="flex items-center text-green-500"><svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> {correctCount}</span>
                                    <span className="flex items-center text-red-500"><svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg> {incorrectCount}</span>
                                </div>
                            </div>

                            {/* Pregunta Texto */}
                            <div className="mb-10">
                                <h3 className="text-2xl md:text-[28px] font-extrabold text-[#1e293b] leading-tight">
                                    {questions[currentQuestionIndex].englishText}
                                </h3>
                                <p className="text-[#64748b] font-medium mt-3 text-[17px]">{questions[currentQuestionIndex].instruction}</p>
                            </div>

                            {/* Opciones */}
                            <div className="space-y-4">
                                {questions[currentQuestionIndex].options.map((opt, idx) => {
                                    const isSelected = answers[currentQuestionIndex]?.indexClicked === idx;
                                    const isCorrect = questions[currentQuestionIndex].shuffledCorrectIndex === idx;
                                    
                                    let btnClass = "w-full text-left p-4 rounded-[1.25rem] border-2 transition-all duration-300 flex items-center cursor-pointer group outline-none font-bold text-[17px] shadow-sm ";
                                    let letterClass = "w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm mr-4 transition-colors shadow-inner ";
                                    
                                    if (isAnswered) {
                                        if (isCorrect) {
                                            btnClass += "bg-[#f0fdf4] border-[#22c55e] text-[#166534] shadow-[0_0_20px_rgba(34,197,94,0.1)]";
                                            letterClass += "bg-[#22c55e] text-white";
                                        }
                                        else if (isSelected) {
                                            btnClass += "bg-[#fef2f2] border-[#ef4444] text-[#991b1b]";
                                            letterClass += "bg-[#ef4444] text-white";
                                        }
                                        else {
                                            btnClass += "bg-white border-[#f1f5f9] text-gray-400 opacity-60";
                                            letterClass += "bg-gray-100 text-gray-400";
                                        }
                                    } else {
                                        // Normal hover
                                        btnClass += "bg-white border-[#f1f5f9] text-[#334155] hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100 transform active:scale-95";
                                        letterClass += "bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white";
                                    }

                                    return (
                                        <button key={idx} onClick={() => handleSelectOption(idx)} disabled={isAnswered} className={btnClass}>
                                            <div className={letterClass}>{optionLetters[idx]}</div>
                                            <span>{opt}</span>
                                            {isAnswered && isCorrect && <svg className="w-6 h-6 ml-auto text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Controles */}
                            <div className="mt-10 flex flex-col sm:flex-row items-center justify-between">
                                <button onClick={() => setShowHint(!showHint)} className="text-blue-500 hover:text-blue-700 font-bold mb-6 sm:mb-0">
                                    {showHint ? `Hint: ${questions[currentQuestionIndex].hint}` : 'Show Hint'}
                                </button>
                                
                                <EdTechButton onClick={handleNextQuestion} disabled={!isAnswered} className="w-full sm:w-auto">
                                    {currentQuestionIndex === questions.length - 1 ? "Finish Summary" : "Next Question"}
                                </EdTechButton>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO RESULTADO --- */}
                {view === 'result' && (
                    <div className="bg-white p-12 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] max-w-md w-full text-center -mt-16 relative">
                        <img src="/edtech-bg.png" alt="Success" className="h-40 mx-auto -mt-24 mb-6 hover:-translate-y-2 transition-transform drop-shadow-xl" />
                        
                        <h2 className="text-3xl font-extrabold text-[#1e293b] mb-2 tracking-tight">Well Done!</h2>
                        <p className="text-[#64748b] font-medium mb-10 text-[17px]">You have successfully completed the examination.</p>
                        
                        <div className="bg-gradient-to-tr from-blue-50 to-cyan-50 rounded-3xl p-8 mb-10 border border-blue-100">
                            <div className="text-6xl font-black text-blue-600 mb-2">
                                {correctCount}<span className="text-3xl text-blue-300">/{questions.length}</span>
                            </div>
                            <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full inline-block font-bold tracking-widest text-sm shadow-md shadow-blue-500/30">
                                {(correctCount / questions.length * 100).toFixed(0)}% ACCURACY
                            </div>
                        </div>

                        <EdTechButton onClick={() => setView('start')} ghost className="w-full text-lg">
                            Back to Exam Home
                        </EdTechButton>
                    </div>
                )}

                {/* --- MÓDULO PANEL DOCENTE (The EdTech Reference Style) --- */}
                {view === 'dashboard' && userRole === 'docente' && (
                    <div className="w-full -mt-20">
                        {/* THE 3 OVERLAPPING CIRCLES FROM THE REFERENCE IMAGE */}
                        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] p-6 mb-8 flex justify-around items-center max-w-2xl mx-auto w-full relative z-20">
                            <div className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full border-[6px] border-blue-100 flex items-center justify-center mb-3 text-2xl font-black text-slate-800 shadow-inner">
                                    {totalAttempted > 0 ? (resultsData[0]?.score || 0) : '-'}
                                </div>
                                <span className="text-sm font-bold text-slate-400 capitalize">Recent Score</span>
                            </div>
                            <div className="w-px h-16 bg-slate-100"></div>
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full border-[8px] border-blue-500 bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center mb-3 text-3xl font-black text-white shadow-lg shadow-blue-500/40">
                                    {totalAttempted}
                                </div>
                                <span className="text-[15px] font-extrabold text-slate-700 capitalize">Attempted</span>
                            </div>
                            <div className="w-px h-16 bg-slate-100"></div>
                            <div className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full border-[6px] border-green-100 flex items-center justify-center mb-3 text-2xl font-black text-slate-800 shadow-inner relative">
                                    {globalAcc}<span className="text-sm absolute right-1 bottom-4 text-green-500">%</span>
                                </div>
                                <span className="text-sm font-bold text-slate-400 capitalize">Accuracy</span>
                            </div>
                        </div>

                        {/* LISTA DE ESTUDIANTES */}
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden pt-6">
                            <h3 className="px-8 font-extrabold text-[#1e293b] text-xl mb-4">Teacher Results Overview</h3>
                            
                            {resultsData.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 mx-4 mb-4 rounded-3xl border border-slate-100">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-500 font-bold">No exam submissions yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {resultsData.map((res) => {
                                        const percentage = (res.score / res.total) * 100;
                                        return (
                                            <div key={res.id} className="p-6 md:px-8 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between">
                                                
                                                <div className="flex items-center mb-4 md:mb-0">
                                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mr-4">
                                                        {res.studentName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-extrabold text-[#1e293b] text-lg">{res.studentName}</h4>
                                                        <p className="text-slate-400 text-sm font-bold">{new Date(res.timestamp).toLocaleDateString()} at {new Date(res.timestamp).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <span className="font-black text-2xl text-[#1e293b]">{percentage.toFixed(0)}<span className="text-lg text-slate-400">%</span></span>
                                                    </div>
                                                    {/* Custom Data mapping mini bar */}
                                                    <div className="flex h-2.5 w-40 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
