import React, { useState, useEffect, useCallback, memo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, fetchSignInMethodsForEmail } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, where, getDocsFromServer } from 'firebase/firestore';
import AdminPanel from './AdminPanel.jsx';

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
const EXAM_NAME = 'English Grammar Exam';
const QUIZ_PROGRESS_STORAGE_PREFIX = 'english-grammar-exam-progress-v1';
const TEACHER_EMAIL = 'lucimar132803@gmail.com';

const normalizeKey = (value = '') =>
    String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

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

    // Multi-exam state
    const [examsList, setExamsList] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState(null);
    const [selectedExamTitle, setSelectedExamTitle] = useState('');
    const [completedExamIds, setCompletedExamIds] = useState(new Set());

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
    const [isRefreshingResults, setIsRefreshingResults] = useState(false);
    const [dashboardStatus, setDashboardStatus] = useState('');
    const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
    const [restoreNotice, setRestoreNotice] = useState('');

    const handleNameChange = useCallback((e) => setNameStr(e.target.value), []);
    const handleEmailChange = useCallback((e) => setEmailStr(e.target.value), []);
    const handlePasswordChange = useCallback((e) => setPassStr(e.target.value), []);
    const handleToggleRegister = useCallback((e) => {
        e.preventDefault();
        setIsRegistering(prev => !prev);
        setErrorMsg('');
    }, []);

    const fetchTeacherResultsFromServer = useCallback(async () => {
        const rRef = query(collection(db, 'calificaciones'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocsFromServer(rRef);
        const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setResultsData(data);
        return data.length;
    }, []);

    const getQuizStorageKey = useCallback((uid) => `${QUIZ_PROGRESS_STORAGE_PREFIX}:${uid}`, []);

    const clearQuizProgress = useCallback((uid) => {
        if (!uid) return;
        try {
            localStorage.removeItem(getQuizStorageKey(uid));
        } catch {
            // Ignore storage cleanup errors.
        }
    }, [getQuizStorageKey]);

    const loadQuizProgress = useCallback((uid) => {
        if (!uid) return null;
        try {
            const raw = localStorage.getItem(getQuizStorageKey(uid));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }, [getQuizStorageKey]);

    const saveQuizProgress = useCallback((uid, progress) => {
        if (!uid) return;
        try {
            localStorage.setItem(getQuizStorageKey(uid), JSON.stringify(progress));
        } catch {
            // Ignore storage quota errors.
        }
    }, [getQuizStorageKey]);

    // --- EFECTOS ---
    useEffect(() => {
        setHasAttemptedRestore(false);
    }, [user?.uid]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const userDocRef = doc(db, "usuarios", currentUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    const isTeacher = currentUser.email?.toLowerCase() === TEACHER_EMAIL;

                    if (isTeacher) {
                        const teacherData = {
                            email: currentUser.email,
                            rol: 'docente',
                            nombre: currentUser.displayName || 'Teacher',
                            createdAt: new Date().toISOString()
                        };
                        if (!userDoc.exists() || userDoc.data()?.rol !== 'docente') {
                            await setDoc(userDocRef, teacherData, { merge: true });
                        }
                        setUserRole('docente');
                        setView('dashboard');
                    } else if (userDoc.exists()) {
                        const rol = userDoc.data().rol;
                        setUserRole(rol);
                        setView(rol === 'docente' ? 'dashboard' : 'select-exam');
                        if (rol === 'estudiante') setNameStr(userDoc.data().nombre || currentUser.email);
                    } else {
                        await setDoc(userDocRef, {
                            email: currentUser.email,
                            rol: 'estudiante',
                            nombre: currentUser.displayName || currentUser.email,
                            createdAt: new Date().toISOString()
                        });
                        setUserRole('estudiante');
                        setView('select-exam');
                    }
                } catch(e) {
                    console.error("Error reading user role:", e);
                    if (currentUser.email?.toLowerCase() === TEACHER_EMAIL) {
                        setUserRole('docente');
                        setView('dashboard');
                    } else {
                        setUserRole('estudiante');
                        setView('select-exam');
                    }
                }
            } else {
                setUserRole(null);
                setView('auth');
            }
            setAuthLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    // Load exams catalog from Firebase
    useEffect(() => {
        if (!user || userRole !== 'estudiante') return;
        const unsub = onSnapshot(collection(db, 'examenes'), (snapshot) => {
            const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            exams.sort((a, b) => (a.order || 0) - (b.order || 0));
            setExamsList(exams);
        });
        return () => unsub();
    }, [user, userRole]);

    // Load student's completed exams from calificaciones
    useEffect(() => {
        if (!user || userRole !== 'estudiante') return;
        const cRef = query(collection(db, 'calificaciones'), where('uid', '==', user.uid));
        const unsub = onSnapshot(cRef, (snapshot) => {
            const completed = new Set();
            const primaryExam = examsList[0];
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.examId) {
                    completed.add(data.examId);
                } else if (primaryExam) {
                    const legacyName = normalizeKey(data.examName || data.testName || '');
                    const primaryTitle = normalizeKey(primaryExam.title || '');
                    if (legacyName && legacyName === primaryTitle) {
                        completed.add(primaryExam.examId);
                    }
                }
            });
            setCompletedExamIds(completed);
        });
        return () => unsub();
    }, [user, userRole, examsList]);

    // Load questions from Firebase filtered by examId
    useEffect(() => {
        if (!user || userRole !== 'estudiante' || !selectedExamId || view === 'quiz') return;
        const qRef = query(collection(db, 'preguntas'), where('examId', '==', selectedExamId));
        const unsub = onSnapshot(qRef, (snapshot) => {
            const loaded = snapshot.docs.map(doc => {
                const data = doc.data();
                const correctString = data.options[data.correctIndex]; 
                const shuffledOptions = [...data.options].sort(() => Math.random() - 0.5);
                const newCorrectIndex = shuffledOptions.indexOf(correctString);
                return { fbId: doc.id, ...data, options: shuffledOptions, shuffledCorrectIndex: newCorrectIndex };
            });
            loaded.sort((a, b) => {
                const aId = Number(a.id ?? a.order ?? 0);
                const bId = Number(b.id ?? b.order ?? 0);
                return aId - bId;
            });
            setQuestions(loaded);
        });
        return () => unsub();
    }, [user, userRole, selectedExamId, view]);

    // Dashboard listener for docente
    useEffect(() => {
        if (!user || userRole !== 'docente' || view !== 'dashboard') return;
        const rRef = query(collection(db, 'calificaciones'), orderBy('timestamp', 'desc'));
        const unsub = onSnapshot(rRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setResultsData(data);
            setDashboardStatus(`Live sync active. Last update: ${new Date().toLocaleString()}`);
        });
        return () => unsub();
    }, [user, userRole, view]);

    useEffect(() => {
        if (!user || userRole !== 'estudiante' || hasAttemptedRestore) return;
        setHasAttemptedRestore(true);

        const saved = loadQuizProgress(user.uid);
        if (!saved) return;

        const hasQuestions = Array.isArray(saved.questions) && saved.questions.length > 0;
        const hasAnswers = Array.isArray(saved.answers);

        if (!hasQuestions || !hasAnswers) {
            clearQuizProgress(user.uid);
            return;
        }

        const safeCurrentIndex = Math.min(
            Math.max(Number(saved.currentQuestionIndex) || 0, 0),
            saved.questions.length - 1
        );

        if (saved.selectedExamId && selectedExamId && saved.selectedExamId !== selectedExamId) {
            return;
        }

        setQuestions(saved.questions);
        setAnswers(saved.answers);
        setCurrentQuestionIndex(safeCurrentIndex);
        setIsAnswered(Boolean(saved.isAnswered));
        setShowHint(Boolean(saved.showHint));
        setCorrectCount(Number(saved.correctCount) || 0);
        setIncorrectCount(Number(saved.incorrectCount) || 0);
        if (saved.selectedExamId) setSelectedExamId(saved.selectedExamId);
        if (saved.selectedExamTitle) setSelectedExamTitle(saved.selectedExamTitle);
        setRestoreNotice('Your previous progress was restored from this device.');
        setView('quiz');
    }, [user, userRole, hasAttemptedRestore, loadQuizProgress, clearQuizProgress]);

    useEffect(() => {
        if (!restoreNotice) return;
        const timer = setTimeout(() => setRestoreNotice(''), 6000);
        return () => clearTimeout(timer);
    }, [restoreNotice]);

    useEffect(() => {
        if (!user || userRole !== 'estudiante' || view !== 'quiz' || questions.length === 0) return;

        const savedExamMatches = !selectedExamId || questions.every(q => q.examId === selectedExamId);
        if (!savedExamMatches) return;

        saveQuizProgress(user.uid, {
            questions,
            answers,
            currentQuestionIndex,
            isAnswered,
            showHint,
            correctCount,
            incorrectCount,
            selectedExamId,
            selectedExamTitle,
            updatedAt: new Date().toISOString(),
        });
    }, [
        user,
        userRole,
        view,
        questions,
        answers,
        currentQuestionIndex,
        isAnswered,
        showHint,
        correctCount,
        incorrectCount,
        selectedExamId,
        selectedExamTitle,
        saveQuizProgress,
    ]);

    // --- MANEJADORES ---
    const handleAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            const normalizedEmail = emailStr.trim().toLowerCase();
            try {
                await signInWithEmailAndPassword(auth, normalizedEmail, passStr);
                return;
            } catch (signInError) {
                const signInCode = signInError?.code;
                const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
                const hasPasswordProvider = signInMethods.includes('password');

                if (signInMethods.length > 0 && !hasPasswordProvider) {
                    setErrorMsg('This email already exists with another sign-in method. Use the same provider or contact the teacher.');
                    return;
                }

                if (hasPasswordProvider || signInCode === 'auth/user-not-found' || signInMethods.length === 0) {
                    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, passStr);
                    await setDoc(doc(db, "usuarios", cred.user.uid), {
                        email: normalizedEmail,
                        rol: 'estudiante',
                        nombre: nameStr.trim() || normalizedEmail,
                        createdAt: new Date().toISOString()
                    });
                    return;
                }

                throw signInError;
            }
        } catch (error) {
            console.error(error);
            const code = error?.code;
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
                setErrorMsg('Password incorrect.');
            } else if (code === 'auth/email-already-in-use') {
                setErrorMsg('This account already exists. Please sign in with the correct password.');
            } else if (code === 'auth/weak-password') {
                setErrorMsg('Password is too weak. Use at least 6 characters.');
            } else if (code === 'auth/invalid-email') {
                setErrorMsg('Invalid email address.');
            } else {
                setErrorMsg('Could not sign in or register. Check your email and password.');
            }
        }
    };

    const handleLogout = () => signOut(auth);

    const handleRefreshResults = useCallback(async () => {
        setIsRefreshingResults(true);
        try {
            const total = await fetchTeacherResultsFromServer();
            setDashboardStatus(`Refreshed from Firebase server at ${new Date().toLocaleString()} (${total} records).`);
        } catch (err) {
            console.error('Error refreshing teacher results:', err);
            setDashboardStatus('Could not refresh from server. Live sync is still active.');
        } finally {
            setIsRefreshingResults(false);
        }
    }, [fetchTeacherResultsFromServer]);

    const handleSelectExam = (exam) => {
        if (exam.active === false) {
            setErrorMsg('This exam is currently inactive.');
            return;
        }
        setSelectedExamId(exam.examId);
        setSelectedExamTitle(exam.title);
        setQuestions([]);
        setErrorMsg('');
        setView('start');
    };

    const handleBackToExams = () => {
        setSelectedExamId(null);
        setSelectedExamTitle('');
        setQuestions([]);
        setErrorMsg('');
        setView('select-exam');
    };

    const handleStartQuiz = () => {
        if(questions.length === 0) {
            setErrorMsg('Questions are still syncing. Please try again in a few seconds.');
            return;
        }
        if (selectedExamId && completedExamIds.has(selectedExamId)) {
            setErrorMsg('You already completed this exam.');
            return;
        }
        if (selectedExamId && questions.some(q => q.examId !== selectedExamId)) {
            setErrorMsg('Loaded questions do not match the selected exam. Please go back and select it again.');
            return;
        }
        clearQuizProgress(user?.uid);
        setRestoreNotice('');
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
                    examName: selectedExamTitle || EXAM_NAME,
                    examId: selectedExamId || '',
                    score: correctCount,
                    total: questions.length,
                    incorrectAnswers: incorrectCount,
                    finalPercentage: Number(((correctCount / questions.length) * 100).toFixed(0)),
                    answers: answers,
                    timestamp: new Date().toISOString(),
                });
                clearQuizProgress(user.uid);
                setRestoreNotice('');
                setView('result');
            } catch (err) {
                console.error("Error saving:", err);
                setErrorMsg('Connection error while saving your score.');
            }
        }
    };

    // --- RENDERIZADO PRINCIPAL ---
    if (!authLoaded) return <div className="flex justify-center items-center h-screen bg-[#f4f7fe] text-[#64748b] font-medium animate-pulse">Loading Teacher Elimar Roa English Exam...</div>;

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
                                {userRole === 'docente' ? 'Teacher Results Panel' : (selectedExamTitle || 'English Exam Home')}
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
                                        <span className="text-[11px] font-extrabold text-blue-600 hover:text-blue-800 cursor-pointer">Forgot?</span>
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
                                        {isRegistering ? 'Create Account' : 'Sign In / Create Account'}
                                    </EdTechButton>
                                </div>
                            </form>

                            <div className="mt-8 text-center md:text-left">
                                <p className="text-slate-500 text-[14px] font-medium">
                                    {isRegistering ? 'Already registered? ' : 'If the student already exists, sign-in will be used automatically. '}
                                    <button onClick={handleToggleRegister} className="text-blue-600 font-extrabold hover:text-blue-800 transition-colors">
                                        {isRegistering ? 'Sign In' : 'Create Account'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO SELECCIÓN DE EXAMEN --- */}
                {view === 'select-exam' && userRole === 'estudiante' && (
                    <div className="w-full bg-white p-8 md:p-12 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] -mt-16">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-extrabold text-[#1e293b] mb-3">Available Exams</h2>
                            <p className="text-[#64748b] text-[17px] font-medium">Select an exam to begin. Teacher Elimar Roa's official exams.</p>
                        </div>
                        {examsList.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50 rounded-3xl border border-slate-100">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                    <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                </div>
                                <p className="text-slate-500 font-bold">Loading exams...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {examsList.map((exam, idx) => {
                                    const isActive = exam.active !== false;
                                    const isCompleted = completedExamIds.has(exam.examId);
                                    return (
                                    <button key={exam.id} onClick={() => isActive && !isCompleted && handleSelectExam(exam)} disabled={!isActive || isCompleted}
                                        className={`group text-left p-8 rounded-[1.5rem] border-2 transition-all duration-300 ${
                                            !isActive
                                                ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-50'
                                                : isCompleted
                                                ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-70'
                                                : 'bg-gradient-to-br from-slate-50 to-white border-slate-100 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100 transform hover:-translate-y-1 active:scale-[0.98]'
                                        }`}>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg transition-transform ${
                                                !isActive
                                                    ? 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/30'
                                                    : isCompleted
                                                    ? 'bg-gradient-to-br from-green-500 to-emerald-400 shadow-green-500/30'
                                                    : 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-blue-500/30 group-hover:scale-110'
                                            }`}>
                                                {!isActive ? 'Off' : isCompleted ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> : idx + 1}
                                            </div>
                                            {!isActive ? (
                                                <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                                            ) : isCompleted ? (
                                                <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-200">Completed ✓</span>
                                            ) : (
                                                <svg className="w-6 h-6 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            )}
                                        </div>
                                        <h3 className={`text-xl font-extrabold mb-2 transition-colors ${!isActive || isCompleted ? 'text-slate-400' : 'text-[#1e293b] group-hover:text-blue-700'}`}>{exam.title}</h3>
                                        <p className="text-[#64748b] text-sm font-medium mb-4 line-clamp-2">{exam.description}</p>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full border ${!isActive || isCompleted ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{exam.totalQuestions} Questions</span>
                                        </div>
                                    </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* --- MÓDULO INICIO ESTUDIANTE (Exam-specific) --- */}
                {view === 'start' && userRole === 'estudiante' && (
                    <div className="w-full bg-white p-8 md:p-12 rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.06)] -mt-16 text-center">
                        <div className="bg-blue-50/50 rounded-3xl p-8 mb-8 inline-block">
                            <img src="/edtech-bg.png" alt="English exam preparation" className="h-48 mx-auto hover:scale-105 transition-transform" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-[#1e293b] mb-2">{selectedExamTitle}</h2>
                        <p className="text-[#64748b] text-[17px] mb-10 max-w-md mx-auto font-medium">
                            This exam has {questions.length || '...'} questions. Choose one answer per question. Your score will be saved at the end.
                        </p>
                        
                        {errorMsg && <p className="text-red-500 mb-6 font-bold bg-red-50 py-3 rounded-xl max-w-sm mx-auto">{errorMsg}</p>}
                        
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <EdTechButton onClick={handleBackToExams} ghost className="text-lg w-full max-w-[200px]">
                                ← Back
                            </EdTechButton>
                            <EdTechButton onClick={handleStartQuiz} className="text-lg w-full max-w-[300px]">
                                Start Exam
                            </EdTechButton>
                        </div>
                    </div>
                )}

                {/* --- MÓDULO EXAMEN --- */}
                {view === 'quiz' && questions.length > 0 && (
                    <div className="w-full max-w-3xl -mt-14">
                        {restoreNotice && (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center justify-between gap-4">
                                <span>{restoreNotice}</span>
                                <button
                                    type="button"
                                    onClick={() => setRestoreNotice('')}
                                    className="text-emerald-700/80 hover:text-emerald-900 transition-colors"
                                    aria-label="Dismiss restored progress notice"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
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
                        <p className="text-[#64748b] font-medium mb-2 text-[17px]">You have successfully completed:</p>
                        <p className="text-blue-600 font-extrabold mb-8 text-lg">{selectedExamTitle || EXAM_NAME}</p>
                        
                        <div className="bg-gradient-to-tr from-blue-50 to-cyan-50 rounded-3xl p-8 mb-10 border border-blue-100">
                            <div className="text-6xl font-black text-blue-600 mb-2">
                                {correctCount}<span className="text-3xl text-blue-300">/{questions.length}</span>
                            </div>
                            <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full inline-block font-bold tracking-widest text-sm shadow-md shadow-blue-500/30">
                                {(correctCount / questions.length * 100).toFixed(0)}% ACCURACY
                            </div>
                        </div>

                        <EdTechButton onClick={() => { setSelectedExamId(null); setSelectedExamTitle(''); setView('select-exam'); }} ghost className="w-full text-lg">
                            Back to Exams
                        </EdTechButton>
                    </div>
                )}

                {/* --- MÓDULO PANEL DOCENTE --- */}
                {view === 'dashboard' && userRole === 'docente' && (
                    <AdminPanel
                        db={db}
                        resultsData={resultsData}
                        dashboardStatus={dashboardStatus}
                        isRefreshingResults={isRefreshingResults}
                        handleRefreshResults={handleRefreshResults}
                        EXAM_NAME={EXAM_NAME}
                    />
                )}
            </div>
        </div>
    );
}
