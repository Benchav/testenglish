import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where, updateDoc } from 'firebase/firestore';

export default function AdminPanel({ db, resultsData, dashboardStatus, isRefreshingResults, handleRefreshResults, EXAM_NAME }) {
    const [adminTab, setAdminTab] = useState('grades'); // 'grades' | 'exams' | 'create-exam'
    const [examsList, setExamsList] = useState([]);
    const [filterExamId, setFilterExamId] = useState('all');
    const LEGACY_EXAM_ID = 'english-grammar-exam';

    // Create exam form state
    const [newExamTitle, setNewExamTitle] = useState('');
    const [newExamDesc, setNewExamDesc] = useState('');
    const [newQuestions, setNewQuestions] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    // Edit question modal
    const [editingQ, setEditingQ] = useState(null);

    // Load exams
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'examenes'), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (a.order || 0) - (b.order || 0));
            setExamsList(data);
        });
        return () => unsub();
    }, [db]);

    const filteredResults = filterExamId === 'all'
        ? resultsData
        : resultsData.filter(r => {
            if (filterExamId === LEGACY_EXAM_ID) {
                return !r.examId && r.examName === EXAM_NAME;
            }
            return r.examId === filterExamId;
        });

    const legacyResultsAvailable = resultsData.some(r => !r.examId && r.examName === EXAM_NAME);

    // --- Metrics ---
    const totalAttempted = filteredResults.length;
    const totalScore = filteredResults.reduce((a, c) => a + (Number(c.score) || 0), 0);
    const maxScore = filteredResults.reduce((a, c) => a + (Number(c.total) || 0), 0);
    const globalAcc = totalAttempted > 0 && maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // --- Question helpers ---
    const addEmptyQuestion = () => {
        setNewQuestions(prev => [...prev, {
            id: prev.length + 1,
            instruction: 'Choose the correct answer:',
            englishText: '',
            options: ['', '', '', ''],
            correctIndex: 0,
            hint: ''
        }]);
    };

    const updateQuestion = (idx, field, value) => {
        setNewQuestions(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const updateOption = (qIdx, optIdx, value) => {
        setNewQuestions(prev => {
            const copy = [...prev];
            const opts = [...copy[qIdx].options];
            opts[optIdx] = value;
            copy[qIdx] = { ...copy[qIdx], options: opts };
            return copy;
        });
    };

    const removeQuestion = (idx) => {
        setNewQuestions(prev => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, id: i + 1 })));
    };

    // --- Save exam ---
    const handleSaveExam = async () => {
        if (!newExamTitle.trim()) return setSaveMsg('Enter an exam title.');
        if (newQuestions.length === 0) return setSaveMsg('Add at least one question.');
        const incomplete = newQuestions.find(q => !q.englishText.trim() || q.options.some(o => !o.trim()));
        if (incomplete) return setSaveMsg(`Question ${incomplete.id} is incomplete.`);

        setIsSaving(true);
        setSaveMsg('');
        try {
            const examId = newExamTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const maxOrder = examsList.reduce((m, e) => Math.max(m, e.order || 0), 0);

            // Save exam metadata
            await setDoc(doc(db, 'examenes', examId), {
                examId, title: newExamTitle.trim(), description: newExamDesc.trim(),
                totalQuestions: newQuestions.length, active: true,
                order: maxOrder + 1, createdAt: new Date().toISOString()
            });

            // Save questions
            for (const q of newQuestions) {
                const qId = `${examId.substring(0, 8)}-q${q.id.toString().padStart(2, '0')}`;
                await setDoc(doc(db, 'preguntas', qId), { ...q, examId });
            }

            setSaveMsg(`Exam "${newExamTitle}" saved with ${newQuestions.length} questions!`);
            setNewExamTitle('');
            setNewExamDesc('');
            setNewQuestions([]);
            setAdminTab('exams');
        } catch (e) {
            console.error(e);
            setSaveMsg('Error saving: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Delete exam ---
    const handleDeleteExam = async (exam) => {
        if (!confirm(`Delete "${exam.title}" and all its questions? This cannot be undone.`)) return;
        try {
            // Delete questions
            const qSnap = await getDocs(query(collection(db, 'preguntas'), where('examId', '==', exam.examId)));
            for (const d of qSnap.docs) await deleteDoc(doc(db, 'preguntas', d.id));
            // Delete exam
            await deleteDoc(doc(db, 'examenes', exam.examId));
        } catch (e) {
            console.error(e);
            alert('Error deleting exam: ' + e.message);
        }
    };

    // --- Toggle exam active ---
    const toggleExamActive = async (exam) => {
        try {
            await updateDoc(doc(db, 'examenes', exam.examId), { active: !exam.active });
        } catch (e) { console.error(e); }
    };

    const tabBtn = (tab, label) => (
        <button onClick={() => setAdminTab(tab)}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${adminTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
            {label}
        </button>
    );

    return (
        <div className="w-full -mt-20">
            {/* Tab Navigation */}
            <div className="flex gap-3 mb-6 justify-center relative z-20 flex-wrap">
                {tabBtn('grades', '📊 Student Grades')}
                {tabBtn('exams', '📋 Manage Exams')}
                {tabBtn('create-exam', '➕ Create Exam')}
            </div>

            {/* ==================== GRADES TAB ==================== */}
            {adminTab === 'grades' && (
                <>
                    {/* Stats circles */}
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] p-6 mb-8 flex justify-around items-center max-w-2xl mx-auto w-full relative z-20">
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full border-[6px] border-blue-100 flex items-center justify-center mb-3 text-2xl font-black text-slate-800 shadow-inner">
                                {totalAttempted > 0 ? (filteredResults[0]?.score || 0) : '-'}
                            </div>
                            <span className="text-sm font-bold text-slate-400">Recent Score</span>
                        </div>
                        <div className="w-px h-16 bg-slate-100"></div>
                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full border-[8px] border-blue-500 bg-gradient-to-br from-blue-600 to-cyan-400 flex items-center justify-center mb-3 text-3xl font-black text-white shadow-lg shadow-blue-500/40">
                                {totalAttempted}
                            </div>
                            <span className="text-[15px] font-extrabold text-slate-700">Attempted</span>
                        </div>
                        <div className="w-px h-16 bg-slate-100"></div>
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full border-[6px] border-green-100 flex items-center justify-center mb-3 text-2xl font-black text-slate-800 shadow-inner relative">
                                {globalAcc}<span className="text-sm absolute right-1 bottom-4 text-green-500">%</span>
                            </div>
                            <span className="text-sm font-bold text-slate-400">Accuracy</span>
                        </div>
                    </div>

                    {/* Results list */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden pt-6">
                        <div className="px-8 mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <h3 className="font-extrabold text-[#1e293b] text-xl">Student Results</h3>
                            <div className="flex gap-3 items-center flex-wrap">
                                <select value={filterExamId} onChange={e => setFilterExamId(e.target.value)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 bg-white focus:ring-2 focus:ring-blue-400 outline-none">
                                    <option value="all">All Exams</option>
                                    {examsList.map(e => <option key={e.id} value={e.examId}>{e.title}</option>)}
                                    {legacyResultsAvailable && <option value={LEGACY_EXAM_ID}>{EXAM_NAME} (legacy)</option>}
                                </select>
                                <button onClick={handleRefreshResults} disabled={isRefreshingResults}
                                    className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all border ${isRefreshingResults ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}>
                                    {isRefreshingResults ? 'Refreshing...' : 'Refresh'}
                                </button>
                            </div>
                        </div>
                        <p className="px-8 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{dashboardStatus || 'Live sync active.'}</p>

                        {filteredResults.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 mx-4 mb-4 rounded-3xl border border-slate-100">
                                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-slate-500 font-bold">No submissions found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredResults.map(res => {
                                    const name = res.studentName || 'Unknown';
                                    const total = Number(res.total) || 0;
                                    const score = Number(res.score) || 0;
                                    const pct = total > 0 ? (score / total) * 100 : 0;
                                    const mistakes = typeof res.incorrectAnswers === 'number' ? res.incorrectAnswers : Math.max(total - score, 0);
                                    const examName = res.examName || EXAM_NAME;
                                    const date = res.timestamp ? new Date(res.timestamp) : null;
                                    return (
                                        <div key={res.id} className="p-6 md:px-8 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center">
                                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg mr-4">
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="font-extrabold text-[#1e293b] text-lg">{name}</h4>
                                                    <p className="text-slate-400 text-sm font-bold">
                                                        {date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : 'No date'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                                                <div className="flex flex-wrap md:justify-end gap-2 mb-3">
                                                    <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Test: {examName}</span>
                                                    <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Score: {score}/{total}</span>
                                                    <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">Mistakes: {mistakes}</span>
                                                </div>
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <span className="font-black text-2xl text-[#1e293b]">{pct.toFixed(0)}<span className="text-lg text-slate-400">%</span></span>
                                                </div>
                                                <div className="flex h-2.5 w-40 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ==================== MANAGE EXAMS TAB ==================== */}
            {adminTab === 'exams' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                    <h3 className="font-extrabold text-[#1e293b] text-xl mb-6">Exam Catalog</h3>
                    {examsList.length === 0 ? (
                        <p className="text-slate-400 font-bold text-center py-12">No exams created yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {examsList.map(exam => (
                                <div key={exam.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white transition-colors gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-extrabold text-[#1e293b] text-lg">{exam.title}</h4>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${exam.active !== false ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                                                {exam.active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-sm mb-2">{exam.description}</p>
                                        <div className="flex gap-3 text-xs font-bold text-slate-400">
                                            <span>{exam.totalQuestions} questions</span>
                                            <span>•</span>
                                            <span>Order: {exam.order}</span>
                                            <span>•</span>
                                            <span>ID: {exam.examId}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => toggleExamActive(exam)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${exam.active !== false ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                                            {exam.active !== false ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button onClick={() => handleDeleteExam(exam)}
                                            className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== CREATE EXAM TAB ==================== */}
            {adminTab === 'create-exam' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
                    <h3 className="font-extrabold text-[#1e293b] text-xl mb-6">Create New Exam</h3>

                    {/* Exam meta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <div>
                            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">Exam Title *</label>
                            <input value={newExamTitle} onChange={e => setNewExamTitle(e.target.value)} placeholder="e.g. Past Simple and Past Continuous"
                                className="w-full px-5 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                            <input value={newExamDesc} onChange={e => setNewExamDesc(e.target.value)} placeholder="Brief description of the exam"
                                className="w-full px-5 py-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                        </div>
                    </div>

                    {/* Questions list */}
                    <div className="mb-6 flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-700">Questions ({newQuestions.length})</h4>
                        <button onClick={addEmptyQuestion}
                            className="px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25">
                            + Add Question
                        </button>
                    </div>

                    {newQuestions.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <p className="text-slate-400 font-bold mb-2">No questions yet</p>
                            <p className="text-slate-400 text-sm">Click "Add Question" to start building your exam.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {newQuestions.map((q, idx) => (
                                <div key={idx} className="p-6 rounded-2xl border border-slate-100 bg-slate-50 relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Q{q.id}</span>
                                        <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-600 text-sm font-bold">✕ Remove</button>
                                    </div>

                                    <div className="mb-3">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">Instruction</label>
                                        <input value={q.instruction} onChange={e => updateQuestion(idx, 'instruction', e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:border-blue-400 outline-none" />
                                    </div>

                                    <div className="mb-3">
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">Question Text *</label>
                                        <textarea value={q.englishText} onChange={e => updateQuestion(idx, 'englishText', e.target.value)} rows={2}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:border-blue-400 outline-none resize-none" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-2">
                                                <button onClick={() => updateQuestion(idx, 'correctIndex', oIdx)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-black shrink-0 transition-all ${q.correctIndex === oIdx ? 'bg-green-500 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                                    {['A','B','C','D'][oIdx]}
                                                </button>
                                                <input value={opt} onChange={e => updateOption(idx, oIdx, e.target.value)} placeholder={`Option ${['A','B','C','D'][oIdx]}`}
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:border-blue-400 outline-none" />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold mb-3">Click A/B/C/D to set correct answer. Current: <span className="text-green-600">{['A','B','C','D'][q.correctIndex]}</span></p>

                                    <div>
                                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 block">Hint (optional)</label>
                                        <input value={q.hint} onChange={e => updateQuestion(idx, 'hint', e.target.value)}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 focus:border-blue-400 outline-none" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Save */}
                    {saveMsg && (
                        <div className={`mt-4 p-4 rounded-2xl font-bold text-sm ${saveMsg.includes('Error') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                            {saveMsg}
                        </div>
                    )}
                    {newQuestions.length > 0 && (
                        <div className="mt-6 flex justify-end">
                            <button onClick={handleSaveExam} disabled={isSaving}
                                className={`px-8 py-3.5 rounded-full font-bold text-[16px] transition-all ${isSaving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform active:scale-95'}`}>
                                {isSaving ? 'Saving...' : `Save Exam (${newQuestions.length} questions)`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
