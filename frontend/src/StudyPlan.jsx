import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { fetchAllSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';
import { fetchCourses } from './services/CourseService';
import { auth, db } from './services/firebase';
import './TasksDeadlines.css';
import './StudyPlan.css';
import React from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_FORM = { date: '', startTime: '', endTime: '', courseId: '', course: '', taskId: '', task: '', taskDueDate: '' };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getWeekStart(offset = 0) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}
function formatDisplay(date) { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function getWeekDates(weekStart) {
  return DAYS.map((_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
}
function getWeekLabel(weekStart) {
  const end = new Date(weekStart); end.setDate(weekStart.getDate() + 6);
  return `${formatDisplay(weekStart)} – ${formatDisplay(end)}`;
}
function getDayName(dateStr) { return DAYS[new Date(dateStr + 'T00:00:00').getDay()]; }
function getWeekOffset(dateStr) {
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0);
  return Math.floor(Math.round((d - getWeekStart(0)) / (1000*60*60*24)) / 7);
}
function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}
function getNowTimeStr() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
}
function timeToMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function minToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function addHoursToTime(time, hours) {
  const [h,m] = time.split(':').map(Number);
  const total = h*60+m+Math.round(hours*60);
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
function getDateForDay(dayName, weekOffset = 0) {
  const weekStart = getWeekStart(weekOffset);
  const d = new Date(weekStart); d.setDate(weekStart.getDate() + DAYS.indexOf(dayName));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function StudySchedule() {
  const [activeTab, setActiveTab] = useState('schedule');

  // ── Auth ──
  const [uid, setUid]                   = useState(null);
  const [authResolved, setAuthResolved] = useState(false);

  // ── Schedule state ──
  const [schedule, setSchedule]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [now, setNow]                   = useState(getNowTimeStr());
  const [coursesList, setCoursesList]   = useState([]);
  const [dropdownTasks, setDropdownTasks] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingTasks, setLoadingTasks]     = useState(false);
  const [availability, setAvailability] = useState([]);

  // ── Delete confirm ──
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [confirmSession, setConfirmSession] = useState(null);

  // ── Generate Session modal ──
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedDay, setSelectedDay]   = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [generating, setGenerating]     = useState(false);
  const [generateMsg, setGenerateMsg]   = useState('');

  // ── FR7: Reschedule modal ──
  const [rescheduleOpen, setRescheduleOpen]       = useState(false);
  const [rescheduleSession, setRescheduleSession] = useState(null);
  const [rescheduleDay, setRescheduleDay]         = useState('');
  const [rescheduleSlot, setRescheduleSlot]       = useState('');
  const [rescheduling, setRescheduling]           = useState(false);
  const [rescheduleMsg, setRescheduleMsg]         = useState('');

  // ── Study Plan state ──
  const [allTasks, setAllTasks]         = useState([]);
  const [courses, setCourses]           = useState([]);
  const [studyPlan, setStudyPlan]       = useState([]);
  const [planLoading, setPlanLoading]   = useState(true);
  const [planGenerating, setPlanGenerating] = useState(false);

  const db2 = getFirestore();

  useEffect(() => {
    const interval = setInterval(() => setNow(getNowTimeStr()), 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Auth + Load all data ──
  useEffect(() => {
    let unsubAvail = null;
    let isFirst = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);
      setAuthResolved(true);
      if (!user) { setLoading(false); setPlanLoading(false); return; }

      // Load availability with real-time listener
      const availRef = doc(db, 'users', user.uid, 'settings', 'weeklyAvailability');
      if (unsubAvail) unsubAvail();
      isFirst = true;
      unsubAvail = onSnapshot(availRef, async (snap) => {
        if (!snap.exists()) return;
        const newAvail = (snap.data().availability || []).map(d => ({ day: d.day, slots: d.slots || [] }));
        setAvailability(newAvail);

        // On subsequent changes, auto-regenerate study plan
        if (isFirst) { isFirst = false; return; }
        const freshTasks = await fetchAllTasks(user.uid);
        setAllTasks(freshTasks);
        const pending = freshTasks.filter(t => !t.completed);
        const availDays = newAvail.filter(d => d.slots?.some(s => s.available));
        if (pending.length === 0 || availDays.length === 0) return;
        const sorted = [...pending].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
        const generated = []; let dayIdx = 0;
        for (const task of sorted) {
          let assigned = false, attempts = 0;
          while (!assigned && attempts < availDays.length) {
            const day = availDays[dayIdx % availDays.length];
            const slot = day.slots.find(s => s.available);
            if (slot && !generated.find(p => p.day === day.day && p.startTime === slot.startTime)) {
              const endTime = addHoursToTime(slot.startTime, 1);
              if (endTime <= slot.endTime) {
                generated.push({ id: Date.now() + Math.random(), day: day.day, startTime: slot.startTime, endTime, task: task.title, course: task.course, dueDate: task.dueDate, priority: task.priority || 'medium' });
                assigned = true;
              }
            }
            dayIdx++; attempts++;
          }
        }
        await setDoc(doc(db, 'users', user.uid, 'settings', 'studyPlan'), { plan: generated, generatedAt: new Date().toISOString() });
        setStudyPlan(generated);
      });

      // Load tasks, courses, saved plan
      const [tasks, allCourses] = await Promise.all([fetchAllTasks(user.uid), fetchCourses(user.uid)]);
      setAllTasks(tasks);
      setCourses(allCourses);
      setCoursesList(allCourses);

      const planSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'studyPlan'));
      if (planSnap.exists()) setStudyPlan(planSnap.data().plan || []);

      setPlanLoading(false);
    });

    return () => { unsubscribe(); if (unsubAvail) unsubAvail(); };
  }, []);

  // ── Load schedule sessions ──
  useEffect(() => {
    if (!authResolved || !uid) return;
    let cancelled = false;
    fetchAllSessions(uid).then(data => {
      if (!cancelled) { setSchedule(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, authResolved]);

  // ── Load courses for add modal ──
  useEffect(() => {
    if (!showForm || !uid) return;
    setLoadingCourses(true);
    getDocs(collection(db2, 'users', uid, 'courses'))
      .then(snap => setCoursesList(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoadingCourses(false));
  }, [showForm, uid]);

  // ── Load tasks for selected course ──
  useEffect(() => {
    if (!form.courseId || !uid) { setDropdownTasks([]); return; }
    setLoadingTasks(true);
    getDocs(collection(db2, 'users', uid, 'courses', form.courseId, 'tasks'))
      .then(snap => setDropdownTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.completed)))
      .catch(console.error)
      .finally(() => setLoadingTasks(false));
  }, [form.courseId, uid]);

  const weekStart     = getWeekStart(weekOffset);
  const weekDates     = getWeekDates(weekStart);
  const toStr         = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weekEnd       = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr  = toStr(weekStart);
  const weekEndStr    = toStr(weekEnd);
  const weekSessions  = schedule.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);

  const availableDays      = availability.filter(d => d.slots?.some(s => s.available));
  const selectedDaySlots   = availability.find(d => d.day === selectedDay)?.slots?.filter(s => s.available) || [];
  const rescheduleDaySlots = availability.find(d => d.day === rescheduleDay)?.slots?.filter(s => s.available) || [];

  // FR6.2
  const completedCount  = weekSessions.filter(s => s.status === 'completed').length;
  const missedCount     = weekSessions.filter(s => s.status === 'missed').length;
  const totalCount      = weekSessions.length;
  const completionRate  = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Handlers ──
  const handleCourseChange = (e) => {
    const c = coursesList.find(c => c.id === e.target.value);
    const label = c ? `${c.code ?? ''} – ${c.name ?? ''}`.trim().replace(/^–\s*/, '') : '';
    setForm(prev => ({ ...prev, courseId: e.target.value, course: label, taskId: '', task: '', taskDueDate: '', date: '' }));
    setDropdownTasks([]);
  };

  const handleTaskChange = (e) => {
    const t = dropdownTasks.find(t => t.id === e.target.value);
    setForm(prev => ({ ...prev, taskId: e.target.value, task: t?.title ?? '', taskDueDate: t?.dueDate ?? '', date: '', startTime: '', endTime: '' }));
  };

  // FR6.1 — Complete
  const handleComplete = async (id, courseId, taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateSession(uid, courseId, taskId, id, { status: newStatus });
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  // FR6.1 — Miss + FR7.1 trigger reschedule
  const handleMiss = async (session) => {
    await updateSession(uid, session.courseId, session.taskId, session.id, { status: 'missed' });
    setSchedule(prev => prev.map(s => s.id === session.id ? { ...s, status: 'missed' } : s));
    setRescheduleSession(session);
    setRescheduleOpen(true);
    setRescheduleMsg('');
    setRescheduleDay('');
    setRescheduleSlot('');
  };

  // FR7.2 — Reschedule
  const handleReschedule = async () => {
    if (!rescheduleDay)  return setRescheduleMsg('Please select a day.');
    if (!rescheduleSlot) return setRescheduleMsg('Please select a time slot.');
    setRescheduling(true);
    try {
      const [slotStart, slotEnd] = rescheduleSlot.split('-');
      const sessionDate  = getDateForDay(rescheduleDay, weekOffset);
      const slotStartMin = timeToMin(slotStart.trim());
      const slotEndMin   = timeToMin(slotEnd.trim());
      const endMin       = slotStartMin + 60;

      if (endMin > slotEndMin) { setRescheduleMsg('Not enough time in this slot.'); setRescheduling(false); return; }

      const busy = schedule.filter(s => s.date === sessionDate && s.id !== rescheduleSession.id).map(s => {
        const [st, en] = s.time.split(' - ');
        return { start: timeToMin(st), end: timeToMin(en) };
      });
      const hasConflict = busy.some(b => !(endMin <= b.start || slotStartMin >= b.end));
      if (hasConflict) { setRescheduleMsg('Slot conflicts with existing session. Choose another.'); setRescheduling(false); return; }

      const newSession = {
        date: sessionDate, day: rescheduleDay,
        weekOffset: getWeekOffset(sessionDate),
        time: `${slotStart.trim()} - ${minToTime(endMin)}`,
        course: rescheduleSession.course,
        task: rescheduleSession.task,
        status: 'pending', rescheduled: true,
      };
      const saved = await addSession(uid, rescheduleSession.courseId, rescheduleSession.taskId, newSession);
      setSchedule(prev => [...prev, saved]);
      setRescheduleMsg(`✅ Rescheduled to ${rescheduleDay} at ${slotStart.trim()}!`);
      setTimeout(() => { setRescheduleOpen(false); setRescheduleSession(null); }, 1500);
    } catch { setRescheduleMsg('Something went wrong.'); }
    finally { setRescheduling(false); }
  };

  // Delete
  const handleDeleteClick   = (s) => { setConfirmSession(s); setConfirmOpen(true); };
  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    await deleteSession(uid, confirmSession.courseId, confirmSession.taskId, confirmSession.id);
    setSchedule(prev => prev.filter(s => s.id !== confirmSession.id));
    setConfirmSession(null);
  };

  // Add session — FR4.2 check
  const handleAdd = async () => {
    if (!form.courseId)  return alert('Please select a course.');
    if (!form.taskId)    return alert('Please select a task.');
    if (!form.date)      return alert('Please pick a date.');
    if (!form.startTime) return alert('Please pick a start time.');
    if (!form.endTime)   return alert('Please pick an end time.');
    if (form.endTime <= form.startTime) return alert('End time must be after start time.');
    const today = getTodayStr();
    if (form.date < today) return alert('Session date must be today or in the future.');
    if (form.date === today && form.startTime < getNowTimeStr()) return alert(`Start time must be ${getNowTimeStr()} or later.`);
    if (form.taskDueDate && form.date > form.taskDueDate) return alert(`Date can't be after task due date.`);

    // FR4.2
    const dayAvail = availability.find(d => d.day === getDayName(form.date));
    const inSlot   = dayAvail?.slots?.some(s => s.available && form.startTime >= s.startTime && form.endTime <= s.endTime);
    if (!inSlot) return alert('This time is outside your defined availability. Please choose a time within your available slots.');

    const newSession = {
      date: form.date, day: getDayName(form.date), weekOffset: getWeekOffset(form.date),
      time: `${form.startTime} - ${form.endTime}`, course: form.course, task: form.task, status: 'pending',
    };
    const saved = await addSession(uid, form.courseId, form.taskId, newSession);
    setSchedule(prev => [...prev, saved]);
    setForm(EMPTY_FORM); setDropdownTasks([]); setShowForm(false);
  };

  // Generate sessions (Schedule tab)
  const handleGenerate = async () => {
    if (!selectedDay)  return setGenerateMsg('Please select a day.');
    if (!selectedSlot) return setGenerateMsg('Please select a time slot.');
    setGenerating(true); setGenerateMsg('');
    try {
      const tasks = await fetchAllTasks(uid);
      const pending = tasks.filter(t => !t.completed && t.dueDate >= getTodayStr())
        .sort((a,b) => {
          const p = (PRIORITY_ORDER[a.priority]??1)-(PRIORITY_ORDER[b.priority]??1);
          return p!==0 ? p : new Date(a.dueDate)-new Date(b.dueDate);
        });
      if (pending.length===0) { setGenerateMsg('No pending tasks!'); setGenerating(false); return; }
      const [slotStart, slotEnd] = selectedSlot.split('-');
      const slotStartMin = timeToMin(slotStart.trim());
      const slotEndMin   = timeToMin(slotEnd.trim());
      const sessionDate  = getDateForDay(selectedDay, weekOffset);
      const busy = schedule.filter(s => s.date===sessionDate).map(s => {
        const [st,en] = s.time.split(' - ');
        return { start: timeToMin(st), end: timeToMin(en) };
      });
      let cur = slotStartMin;
      const newSessions = [];
      for (const task of pending) {
        if (cur+60>slotEndMin) break;
        const end = cur+60;
        const conflict = busy.some(b => !(end<=b.start || cur>=b.end));
        if (conflict) { const bl = busy.find(b => !(end<=b.start || cur>=b.end)); if (bl) cur=bl.end; continue; }
        newSessions.push({ task, startStr: minToTime(cur), endStr: minToTime(end) });
        cur = end;
      }
      if (newSessions.length===0) { setGenerateMsg('No free slots. Try another day.'); setGenerating(false); return; }
      for (const { task, startStr, endStr } of newSessions) {
        const s = { date: sessionDate, day: selectedDay, weekOffset: getWeekOffset(sessionDate), time: `${startStr} - ${endStr}`, course: task.course||'', task: task.title||'', status:'pending' };
        const saved = await addSession(uid, task.courseId, task.id, s);
        setSchedule(prev => [...prev, saved]);
      }
      setGenerateMsg(`✅ Scheduled ${newSessions.length} session(s) on ${selectedDay}!`);
      setSelectedDay(''); setSelectedSlot('');
    } catch { setGenerateMsg('Something went wrong.'); }
    finally { setGenerating(false); }
  };

  // Generate study plan (Plan tab)
  const generateStudyPlan = async () => {
    if (!uid) return;
    setPlanGenerating(true);
    const availDays = availability.filter(d => d.slots?.some(s => s.available));
    if (availDays.length===0) { alert('Please set your weekly availability first!'); setPlanGenerating(false); return; }
    const pending = allTasks.filter(t => !t.completed).sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate));
    if (pending.length===0) { alert('No pending tasks!'); setPlanGenerating(false); return; }
    const generated=[]; let dayIdx=0;
    for (const task of pending) {
      let assigned=false, attempts=0;
      while (!assigned && attempts<availDays.length) {
        const day = availDays[dayIdx%availDays.length];
        const slot = day.slots.find(s=>s.available);
        if (slot && !generated.find(p=>p.day===day.day && p.startTime===slot.startTime)) {
          const endTime = addHoursToTime(slot.startTime,1);
          if (endTime<=slot.endTime) {
            generated.push({ id:Date.now()+Math.random(), day:day.day, startTime:slot.startTime, endTime, task:task.title, course:task.course, dueDate:task.dueDate, priority:task.priority||'medium' });
            assigned=true;
          }
        }
        dayIdx++; attempts++;
      }
    }
    await setDoc(doc(db,'users',uid,'settings','studyPlan'), { plan:generated, generatedAt:new Date().toISOString() });
    setStudyPlan(generated);
    setPlanGenerating(false);
  };

  const clearStudyPlan = async () => {
    if (!uid) return;
    await setDoc(doc(db,'users',uid,'settings','studyPlan'), { plan:[], generatedAt:new Date().toISOString() });
    setStudyPlan([]);
  };

  if (loading) return <p style={{ padding:'2rem' }}>Loading schedule...</p>;

  const pendingTasks = allTasks.filter(t => !t.completed);

  return (
    <div className="study-schedule-wrapper">

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'20px' }}>
        <button onClick={() => setActiveTab('schedule')} style={{
          flex:1, padding:'12px', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontSize:'15px',
          background: activeTab==='schedule' ? 'linear-gradient(135deg,#e67a5f,#ee9b85)' : '#f0f0f0',
          color: activeTab==='schedule' ? 'white' : '#666', transition:'0.2s',
        }}>📅 Study Schedule</button>
        <button onClick={() => setActiveTab('plan')} style={{
          flex:1, padding:'12px', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'700', fontSize:'15px',
          background: activeTab==='plan' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#f0f0f0',
          color: activeTab==='plan' ? 'white' : '#666', transition:'0.2s',
        }}>📋 Study Plan</button>
      </div>

      {/* ════════ SCHEDULE TAB ════════ */}
      {activeTab === 'schedule' && (
        <>
          <div className="schedule-header">
            <h1 className="schedule-title">Study Schedule</h1>
            <div style={{ display:'flex', gap:'10px' }}>
              <button className="add-session-button" onClick={() => setShowGenerate(true)} style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)' }}>✨ Generate</button>
              <button className="add-session-button" onClick={() => setShowForm(true)}>+ Add Session</button>
            </div>
          </div>

          <div className="week-nav">
            <button className="week-nav-btn" onClick={() => setWeekOffset(w=>w-1)}>← Prev</button>
            <span className="week-nav-label">
              {weekOffset===0?'This Week':weekOffset===1?'Next Week':weekOffset===-1?'Last Week':`Week ${weekOffset>0?'+':''}${weekOffset}`}
              <span className="week-nav-dates">{getWeekLabel(weekStart)}</span>
            </span>
            <button className="week-nav-btn" onClick={() => setWeekOffset(w=>w+1)}>Next →</button>
          </div>

          {/* FR6.2 Stats */}
          <div className="statistics-container">
            <div className="statistic-card"><div className="statistic-number">{totalCount}</div><div className="statistic-label">Total</div></div>
            <div className="statistic-card"><div className="statistic-number">{completedCount}</div><div className="statistic-label">Completed</div></div>
            <div className="statistic-card"><div className="statistic-number">{missedCount}</div><div className="statistic-label">Missed</div></div>
            <div className="statistic-card"><div className="statistic-number">{completionRate}%</div><div className="statistic-label">Completion Rate</div></div>
          </div>

          {/* Calendar */}
          <div className="weekly-calendar-grid">
            {DAYS.map((day,i) => (
              <div key={day} className="calendar-day-column">
                <div className="day-column-header">
                  <div>{day}</div>
                  <div className="day-column-date">{formatDisplay(weekDates[i])}</div>
                </div>
                <div className="day-sessions-list">
                  {weekSessions.filter(s=>s.day===day).map(session => (
                    <div key={session.id} className={`study-session-item ${session.status==='completed'?'session-completed':''} ${session.status==='missed'?'session-missed':''}`}>
                      <div className="session-time">{session.time}</div>
                      <div className="session-course">{session.course}</div>
                      <div className="session-task">{session.task}</div>
                      {session.rescheduled && <div style={{ fontSize:'10px', color:'#7c3aed', fontWeight:'600' }}>🔄 Rescheduled</div>}
                      <div className="session-actions">
                        <button className="complete-session-button" onClick={() => handleComplete(session.id, session.courseId, session.taskId, session.status)} title="Complete">✓</button>
                        <button onClick={() => handleMiss(session)} title="Miss" style={{ width:'26px', height:'26px', border:'none', borderRadius:'5px', cursor:'pointer', fontSize:'11px', background:'#fff3e0', color:'#ff9800' }}>✗</button>
                        <button className="delete-session-button" onClick={() => handleDeleteClick(session)} title="Delete">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════════ STUDY PLAN TAB ════════ */}
      {activeTab === 'plan' && (
        <div className="sp-page" style={{ padding:0 }}>
          <div className="sp-info-grid">
            <div className="sp-info-card"><div className="sp-info-number">{availableDays.length}</div><div className="sp-info-label">Available Days</div></div>
            <div className="sp-info-card"><div className="sp-info-number">{pendingTasks.length}</div><div className="sp-info-label">Pending Tasks</div></div>
            <div className="sp-info-card"><div className="sp-info-number">{courses.length}</div><div className="sp-info-label">Courses</div></div>
            <div className="sp-info-card"><div className="sp-info-number">{studyPlan.length}</div><div className="sp-info-label">Scheduled</div></div>
          </div>

          <div className="sp-form-card">
            <h1 className="sp-heading">📋 Generate Study Plan</h1>
            <p className="sp-note">Automatically generates a weekly plan based on your tasks, deadlines, and availability.</p>
            {pendingTasks.length===0 && <p style={{ color:'#e67a5f', marginBottom:'12px' }}>⚠️ No pending tasks. Add tasks first.</p>}
            {availableDays.length===0 && <p style={{ color:'#e67a5f', marginBottom:'12px' }}>⚠️ No availability set. Update Weekly Availability first.</p>}
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              <button className="sp-generate-btn" onClick={generateStudyPlan} disabled={planGenerating||pendingTasks.length===0||availableDays.length===0}>
                {planGenerating ? '⏳ Generating...' : '✨ Generate My Study Plan'}
              </button>
              {studyPlan.length>0 && (
                <button className="sp-generate-btn" onClick={clearStudyPlan} style={{ background:'#f0f0f0', color:'#666' }}>🗑 Clear Plan</button>
              )}
            </div>
          </div>

          <div className="sp-card">
            <h1 className="sp-heading">Weekly Study Plan</h1>
            <p className="sp-note">{studyPlan.length>0 ? 'Your personalized study plan.' : 'Click "Generate My Study Plan" to create your schedule.'}</p>
            <div className="sp-list">
              {studyPlan.length===0 ? (
                <p className="sp-empty">No study plan generated yet.</p>
              ) : (
                DAYS.map(day => {
                  const dayPlans = studyPlan.filter(p => p.day===day);
                  if (dayPlans.length===0) return null;
                  return (
                    <div className="sp-day-section" key={day}>
                      <h2 className="sp-day-title">{day}</h2>
                      {dayPlans.map(plan => (
                        <div className="sp-session" key={plan.id}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <p className="sp-session-day">🕐 {plan.startTime} – {plan.endTime}</p>
                            <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'12px', fontWeight:'600',
                              background: plan.priority==='high'?'#ffebee':plan.priority==='low'?'#e8f5e9':'#fff3e0',
                              color: plan.priority==='high'?'#f44336':plan.priority==='low'?'#4caf50':'#ff9800' }}>
                              {plan.priority}
                            </span>
                          </div>
                          <p className="sp-session-course">📚 {plan.course}</p>
                          <p className="sp-session-task">📝 {plan.task}</p>
                          {plan.dueDate && <p style={{ fontSize:'11px', color:'#aaa', marginTop:'4px' }}>📅 Due: {plan.dueDate}</p>}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Session Modal ── */}
      {showGenerate && (
        <div className="modal-overlay" onClick={() => { setShowGenerate(false); setGenerateMsg(''); }}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{ maxWidth:'440px' }}>
            <h2 className="modal-title">✨ Generate Sessions</h2>
            <p style={{ color:'#777', fontSize:'13px', marginBottom:'16px', textAlign:'center' }}>Sessions scheduled by priority and deadline, without overlapping existing ones.</p>
            <label className="modal-label">Available Day <span className="modal-required">*</span></label>
            <select className="modal-input" value={selectedDay} onChange={e=>{ setSelectedDay(e.target.value); setSelectedSlot(''); setGenerateMsg(''); }}>
              <option value="">— Select a day —</option>
              {availableDays.map(d=><option key={d.day} value={d.day}>{d.day}</option>)}
            </select>
            {selectedDay && selectedDaySlots.length>0 && (
              <>
                <label className="modal-label">Time Slot <span className="modal-required">*</span></label>
                <select className="modal-input" value={selectedSlot} onChange={e=>{ setSelectedSlot(e.target.value); setGenerateMsg(''); }}>
                  <option value="">— Select a slot —</option>
                  {selectedDaySlots.map((s,i)=><option key={i} value={`${s.startTime}-${s.endTime}`}>{s.startTime} – {s.endTime}</option>)}
                </select>
              </>
            )}
            {selectedDay && selectedDaySlots.length===0 && <p style={{ color:'#e67a5f', fontSize:'13px' }}>No available slots for {selectedDay}.</p>}
            {generateMsg && <p style={{ color:generateMsg.startsWith('✅')?'#4caf50':'#e67a5f', fontSize:'13px', marginTop:'8px', fontWeight:'600', textAlign:'center' }}>{generateMsg}</p>}
            <div className="modal-actions" style={{ marginTop:'20px' }}>
              <button className="modal-cancel" onClick={()=>{ setShowGenerate(false); setGenerateMsg(''); }}>Cancel</button>
              <button className="modal-save" onClick={handleGenerate} disabled={generating||!selectedDay||!selectedSlot} style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', opacity:generating?0.7:1 }}>
                {generating?'⏳ Generating...':'✨ Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Session Modal ── */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Add Session</h2>
            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <select className="modal-input" value={form.courseId} onChange={handleCourseChange} disabled={loadingCourses}>
              <option value="">{loadingCourses?'Loading...':'— Select a course —'}</option>
              {coursesList.map(c=><option key={c.id} value={c.id}>{c.code&&c.name?`${c.code} – ${c.name}`:c.code||c.name||c.id}</option>)}
            </select>
            <label className="modal-label">Task <span className="modal-required">*</span></label>
            <select className="modal-input" value={form.taskId} onChange={handleTaskChange} disabled={!form.courseId||loadingTasks}>
              <option value="">{!form.courseId?'Select a course first':loadingTasks?'Loading...':dropdownTasks.length===0?'No tasks found':'— Select a task —'}</option>
              {dropdownTasks.map(t=><option key={t.id} value={t.id}>{t.title??t.name??t.id}</option>)}
            </select>
            <label className="modal-label">Date <span className="modal-required">*</span></label>
            <input className="modal-input" type="date" value={form.date} min={getTodayStr()} max={form.taskDueDate||undefined} disabled={!form.taskId} onChange={e=>setForm(prev=>({...prev,date:e.target.value,startTime:'',endTime:''}))} />
            {form.taskId&&form.taskDueDate&&<small style={{ color:'#888', marginBottom:'4px', display:'block' }}>Up to task due date: {form.taskDueDate}</small>}
            <div className="modal-row">
              <div className="modal-col">
                <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                <input className="modal-input" type="time" value={form.startTime} disabled={!form.date} onChange={e=>setForm(prev=>({...prev,startTime:e.target.value}))} />
              </div>
              <div className="modal-col">
                <label className="modal-label">End Time <span className="modal-required">*</span></label>
                <input className="modal-input" type="time" value={form.endTime} min={form.startTime||undefined} disabled={!form.date} onChange={e=>setForm(prev=>({...prev,endTime:e.target.value}))} />
              </div>
            </div>
            <small style={{ color:'#888', display:'block', marginBottom:'4px' }}>⚠️ Must be within your availability slots</small>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={()=>{ setShowForm(false); setForm(EMPTY_FORM); setDropdownTasks([]); }}>Cancel</button>
              <button className="modal-save" onClick={handleAdd}>✓ Add Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FR7: Reschedule Modal ── */}
      {rescheduleOpen && (
        <div className="modal-overlay" onClick={()=>setRescheduleOpen(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{ maxWidth:'440px' }}>
            <h2 className="modal-title">🔄 Reschedule Session</h2>
            <p style={{ color:'#777', fontSize:'13px', marginBottom:'16px', textAlign:'center' }}>
              You missed <strong>"{rescheduleSession?.task}"</strong>. Pick a new day and slot to reschedule it.
            </p>
            <label className="modal-label">Available Day <span className="modal-required">*</span></label>
            <select className="modal-input" value={rescheduleDay} onChange={e=>{ setRescheduleDay(e.target.value); setRescheduleSlot(''); setRescheduleMsg(''); }}>
              <option value="">— Select a day —</option>
              {availableDays.map(d=><option key={d.day} value={d.day}>{d.day}</option>)}
            </select>
            {rescheduleDay && rescheduleDaySlots.length>0 && (
              <>
                <label className="modal-label">Time Slot <span className="modal-required">*</span></label>
                <select className="modal-input" value={rescheduleSlot} onChange={e=>{ setRescheduleSlot(e.target.value); setRescheduleMsg(''); }}>
                  <option value="">— Select a slot —</option>
                  {rescheduleDaySlots.map((s,i)=><option key={i} value={`${s.startTime}-${s.endTime}`}>{s.startTime} – {s.endTime}</option>)}
                </select>
              </>
            )}
            {rescheduleDay && rescheduleDaySlots.length===0 && <p style={{ color:'#e67a5f', fontSize:'13px' }}>No available slots for {rescheduleDay}.</p>}
            {rescheduleMsg && <p style={{ color:rescheduleMsg.startsWith('✅')?'#4caf50':'#e67a5f', fontSize:'13px', marginTop:'8px', fontWeight:'600', textAlign:'center' }}>{rescheduleMsg}</p>}
            <div className="modal-actions" style={{ marginTop:'20px' }}>
              <button className="modal-cancel" onClick={()=>{ setRescheduleOpen(false); setRescheduleSession(null); }}>Skip</button>
              <button className="modal-save" onClick={handleReschedule} disabled={rescheduling||!rescheduleDay||!rescheduleSlot} style={{ background:'linear-gradient(135deg,#7c3aed,#a855f7)', opacity:rescheduling?0.7:1 }}>
                {rescheduling?'⏳ Rescheduling...':'🔄 Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={()=>setConfirmOpen(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{ maxWidth:'380px', textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🗑</div>
            <h2 className="modal-title">Delete Session?</h2>
            <p style={{ color:'#777', fontSize:'14px', margin:'8px 0 24px' }}>This will permanently delete this session.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={()=>setConfirmOpen(false)}>Cancel</button>
              <button className="modal-save" onClick={handleConfirmDelete} style={{ background:'linear-gradient(135deg,#f44336,#e57373)' }}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}