import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { fetchAllSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';
import './ScheduleAndTasks.css';
import React from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_FORM = { date: '', startTime: '', endTime: '', courseId: '', course: '', taskId: '', task: '', taskDueDate: '' };

function getWeekStart(offset = 0) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function formatDisplay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getWeekDates(weekStart) {
  return DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function getWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  return `${formatDisplay(weekStart)} – ${formatDisplay(end)}`;
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return DAYS[d.getDay()];
}

function getWeekOffset(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  const sunday = getWeekStart(0);
  const diffDays = Math.round((d - sunday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function getNowTimeStr() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Get date string for a specific day of current week
function getDateForDay(dayName, weekOffset = 0) {
  const weekStart = getWeekStart(weekOffset);
  const idx = DAYS.indexOf(dayName);
  const d = new Date(weekStart);
  d.setDate(weekStart.getDate() + idx);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function StudySchedule() {
  const [schedule, setSchedule]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [now, setNow]                   = useState(getNowTimeStr());
  const [courses, setCourses]           = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingTasks, setLoadingTasks]     = useState(false);
  const [uid, setUid]                   = useState(null);
  const [authResolved, setAuthResolved] = useState(false);

  // ── Custom confirm modal ──
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [confirmSession, setConfirmSession] = useState(null);

  // ── Generate Study Plan modal ──
  const [showGenerate, setShowGenerate]         = useState(false);
  const [availability, setAvailability]         = useState([]);
  const [selectedDay, setSelectedDay]           = useState('');
  const [selectedSlot, setSelectedSlot]         = useState('');
  const [generating, setGenerating]             = useState(false);
  const [generateMsg, setGenerateMsg]           = useState('');

  const db = getFirestore();

  useEffect(() => {
    const interval = setInterval(() => setNow(getNowTimeStr()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
      setAuthResolved(true);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const weekStart = getWeekStart(weekOffset);
  const weekDates = getWeekDates(weekStart);

  useEffect(() => {
    if (!authResolved || !uid) return;
    let cancelled = false;
    fetchAllSessions(uid).then(data => {
      if (!cancelled) { setSchedule(data); setLoading(false); }
    }).catch(err => {
      console.error('Failed to fetch sessions:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [uid, authResolved]);

  useEffect(() => {
    if (!showForm || !uid) return;
    const loadCourses = async () => {
      setLoadingCourses(true);
      try {
        const snapshot = await getDocs(collection(db, 'users', uid, 'courses'));
        setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };
    loadCourses();
  }, [showForm, uid]);

  useEffect(() => {
    if (!form.courseId || !uid) { setTasks([]); return; }
    setLoadingTasks(true);
    getDocs(collection(db, 'users', uid, 'courses', form.courseId, 'tasks'))
      .then(snapshot => {
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTasks(all.filter(t => !t.completed));
      })
      .catch(err => console.error('Failed to fetch tasks:', err))
      .finally(() => setLoadingTasks(false));
  }, [form.courseId, uid]);

  // Load availability when generate modal opens
  useEffect(() => {
    if (!showGenerate || !uid) return;
    const loadAvailability = async () => {
      const ref  = doc(db, 'users', uid, 'settings', 'weeklyAvailability');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setAvailability(snap.data().availability || []);
      }
    };
    loadAvailability();
  }, [showGenerate, uid]);

  const availableDays = availability.filter(d => d.slots?.some(s => s.available));
  const selectedDaySlots = availability.find(d => d.day === selectedDay)?.slots?.filter(s => s.available) || [];

  const handleCourseChange = (e) => {
    const selectedId = e.target.value;
    const selectedCourse = courses.find(c => c.id === selectedId);
    const label = selectedCourse
      ? `${selectedCourse.code ?? ''} – ${selectedCourse.name ?? ''}`.trim().replace(/^–\s*/, '')
      : '';
    setForm(prev => ({ ...prev, courseId: selectedId, course: label, taskId: '', task: '', taskDueDate: '', date: '' }));
    setTasks([]);
  };

  const handleTaskChange = (e) => {
    const selectedId = e.target.value;
    const selectedTask = tasks.find(t => t.id === selectedId);
    setForm(prev => ({
      ...prev,
      taskId: selectedId,
      task: selectedTask?.title ?? selectedTask?.name ?? '',
      taskDueDate: selectedTask?.dueDate ?? '',
      date: '',
      startTime: '',
      endTime: '',
    }));
  };

  const handleComplete = async (id, courseId, taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateSession(uid, courseId, taskId, id, { status: newStatus });
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const handleDeleteClick = (session) => {
    setConfirmSession(session);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    await deleteSession(uid, confirmSession.courseId, confirmSession.taskId, confirmSession.id);
    setSchedule(prev => prev.filter(s => s.id !== confirmSession.id));
    setConfirmSession(null);
  };

  const handleCancelDelete = () => {
    setConfirmOpen(false);
    setConfirmSession(null);
  };

  const handleAdd = async () => {
    if (!form.courseId)  return alert('Please select a course.');
    if (!form.taskId)    return alert('Please select a task.');
    if (!form.date)      return alert('Please pick a date.');
    if (!form.startTime) return alert('Please pick a start time.');
    if (!form.endTime)   return alert('Please pick an end time.');
    if (form.endTime <= form.startTime) return alert('End time must be after start time.');

    const today = getTodayStr();
    if (form.date < today) return alert('Session date must be today or in the future.');
    if (form.date === today && form.startTime < getNowTimeStr()) {
      return alert(`Start time must be from now (${getNowTimeStr()}) onwards for today's sessions.`);
    }
    if (form.taskDueDate && form.date > form.taskDueDate) {
      return alert(`Session date can't be after the task due date (${form.taskDueDate}).`);
    }

    const newSession = {
      date: form.date,
      day: getDayName(form.date),
      weekOffset: getWeekOffset(form.date),
      time: `${form.startTime} - ${form.endTime}`,
      course: form.course,
      task: form.task,
      status: 'pending',
    };

    const saved = await addSession(uid, form.courseId, form.taskId, newSession);
    setSchedule(prev => [...prev, saved]);
    setForm(EMPTY_FORM);
    setTasks([]);
    setShowForm(false);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setTasks([]);
  };

  // ── Generate Study Plan ──
  const handleGenerate = async () => {
    if (!selectedDay)  return setGenerateMsg('Please select a day.');
    if (!selectedSlot) return setGenerateMsg('Please select a time slot.');

    setGenerating(true);
    setGenerateMsg('');

    try {
      // 1. Fetch all pending tasks sorted by priority + due date
      const allTasks = await fetchAllTasks(uid);
      const pendingTasks = allTasks
        .filter(t => !t.completed && t.dueDate >= getTodayStr())
        .sort((a, b) => {
          const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
          if (pDiff !== 0) return pDiff;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });

      if (pendingTasks.length === 0) {
        setGenerateMsg('No pending tasks found!');
        setGenerating(false);
        return;
      }

      // 2. Parse selected slot
      const [slotStart, slotEnd] = selectedSlot.split('-');
      const slotStartMin = timeToMin(slotStart.trim());
      const slotEndMin   = timeToMin(slotEnd.trim());
      const slotDuration = slotEndMin - slotStartMin; // total available minutes

      // 3. Get date for selected day this week
      const sessionDate = getDateForDay(selectedDay, weekOffset);

      // 4. Get existing sessions on that day to avoid conflicts
      const existingOnDay = schedule.filter(s => s.date === sessionDate);

      // 5. Find free time slots within the chosen slot
      const busySlots = existingOnDay.map(s => {
        const [st, en] = s.time.split(' - ');
        return { start: timeToMin(st), end: timeToMin(en) };
      }).sort((a, b) => a.start - b.start);

      // 6. Schedule tasks in free windows (1 hour each)
      let currentTime = slotStartMin;
      let scheduled = 0;
      const newSessions = [];

      for (const task of pendingTasks) {
        if (currentTime + 60 > slotEndMin) break; // no more room

        // Check conflict with existing sessions
        const endTime = currentTime + 60;
        const hasConflict = busySlots.some(b =>
          !(endTime <= b.start || currentTime >= b.end)
        );

        if (hasConflict) {
          // Skip to after the conflict
          const blocking = busySlots.find(b => !(endTime <= b.start || currentTime >= b.end));
          if (blocking) currentTime = blocking.end;
          continue;
        }

        const startStr = `${String(Math.floor(currentTime / 60)).padStart(2,'0')}:${String(currentTime % 60).padStart(2,'0')}`;
        const endStr   = `${String(Math.floor(endTime / 60)).padStart(2,'0')}:${String(endTime % 60).padStart(2,'0')}`;

        newSessions.push({ task, startStr, endStr });
        currentTime = endTime;
        scheduled++;
      }

      if (newSessions.length === 0) {
        setGenerateMsg('No free time slots available on this day. Choose a different day or slot.');
        setGenerating(false);
        return;
      }

      // 7. Save sessions to Firestore
      for (const { task, startStr, endStr } of newSessions) {
        const newSession = {
          date: sessionDate,
          day: selectedDay,
          weekOffset: getWeekOffset(sessionDate),
          time: `${startStr} - ${endStr}`,
          course: task.course || '',
          task: task.title || '',
          status: 'pending',
        };
        const saved = await addSession(uid, task.courseId, task.id, newSession);
        setSchedule(prev => [...prev, saved]);
      }

      setGenerateMsg(`✅ Successfully scheduled ${newSessions.length} session(s) on ${selectedDay}!`);
      setSelectedDay('');
      setSelectedSlot('');
    } catch (err) {
      console.error('Generate error:', err);
      setGenerateMsg('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = toStr(weekStart);
  const weekEndStr   = toStr(weekEnd);

  const weekSessions = schedule.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);

  if (loading) return <p>Loading schedule...</p>;

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">Study Schedule</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="add-session-button"
            onClick={() => setShowGenerate(true)}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            ✨ Generate Plan
          </button>
          <button className="add-session-button" onClick={() => setShowForm(true)}>
            + Add Session
          </button>
        </div>
      </div>

      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
        <span className="week-nav-label">
          {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          <span className="week-nav-dates">{getWeekLabel(weekStart)}</span>
        </span>
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
      </div>

      {/* ── Generate Study Plan Modal ── */}
      {showGenerate && (
        <div className="modal-overlay" onClick={() => { setShowGenerate(false); setGenerateMsg(''); }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h2 className="modal-title">✨ Generate Study Plan</h2>
            <p style={{ color: '#777', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
              Select a day and time slot. Tasks will be scheduled from highest priority and nearest deadline first, without overlapping your existing sessions.
            </p>

            <label className="modal-label">Available Day <span className="modal-required">*</span></label>
            <select
              className="modal-input"
              value={selectedDay}
              onChange={e => { setSelectedDay(e.target.value); setSelectedSlot(''); setGenerateMsg(''); }}
            >
              <option value="">— Select a day —</option>
              {availableDays.map(d => (
                <option key={d.day} value={d.day}>{d.day}</option>
              ))}
            </select>

            {selectedDay && selectedDaySlots.length > 0 && (
              <>
                <label className="modal-label">Time Slot <span className="modal-required">*</span></label>
                <select
                  className="modal-input"
                  value={selectedSlot}
                  onChange={e => { setSelectedSlot(e.target.value); setGenerateMsg(''); }}
                >
                  <option value="">— Select a slot —</option>
                  {selectedDaySlots.map((slot, i) => (
                    <option key={i} value={`${slot.startTime}-${slot.endTime}`}>
                      {slot.startTime} – {slot.endTime}
                    </option>
                  ))}
                </select>
              </>
            )}

            {selectedDay && selectedDaySlots.length === 0 && (
              <p style={{ color: '#e67a5f', fontSize: '13px', marginTop: '8px' }}>
                No available slots for {selectedDay}. Update your Weekly Availability first.
              </p>
            )}

            {generateMsg && (
              <p style={{
                color: generateMsg.startsWith('✅') ? '#4caf50' : '#e67a5f',
                fontSize: '13px',
                marginTop: '8px',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                {generateMsg}
              </p>
            )}

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="modal-cancel" onClick={() => { setShowGenerate(false); setGenerateMsg(''); }}>Cancel</button>
              <button
                className="modal-save"
                onClick={handleGenerate}
                disabled={generating || !selectedDay || !selectedSlot}
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', opacity: generating ? 0.7 : 1 }}
              >
                {generating ? '⏳ Generating...' : '✨ Generate'}
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
              <option value="">{loadingCourses ? 'Loading courses...' : '— Select a course —'}</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code && c.name ? `${c.code} – ${c.name}` : c.code || c.name || c.id}
                </option>
              ))}
            </select>

            <label className="modal-label">Task <span className="modal-required">*</span></label>
            <select className="modal-input" value={form.taskId} onChange={handleTaskChange} disabled={!form.courseId || loadingTasks}>
              <option value="">
                {!form.courseId ? 'Select a course first' : loadingTasks ? 'Loading tasks...' : tasks.length === 0 ? 'No tasks found for this course' : '— Select a task —'}
              </option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.title ?? t.name ?? t.id}</option>
              ))}
            </select>

            <label className="modal-label">Date <span className="modal-required">*</span></label>
            <input
              className="modal-input"
              type="date"
              value={form.date}
              min={getTodayStr()}
              max={form.taskDueDate || undefined}
              disabled={!form.taskId}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value, startTime: '', endTime: '' }))}
            />
            {form.taskId && form.taskDueDate && (
              <small style={{ color: '#888', marginBottom: '4px', display: 'block' }}>
                Up to task due date: {form.taskDueDate}
              </small>
            )}

            <div className="modal-row">
              <div className="modal-col">
                <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                <input className="modal-input" type="time" value={form.startTime} min={form.date === getTodayStr() ? now : undefined} disabled={!form.date} onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))} />
              </div>
              <div className="modal-col">
                <label className="modal-label">End Time <span className="modal-required">*</span></label>
                <input className="modal-input" type="time" value={form.endTime} min={form.startTime || undefined} disabled={!form.date} onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))} />
              </div>
            </div>
            {form.date === getTodayStr() && (
              <small style={{ color: '#888', display: 'block', marginBottom: '4px' }}>
                Today's sessions must start at {now} or later
              </small>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleCloseForm}>Cancel</button>
              <button className="modal-save" onClick={handleAdd}>✓ Add Session</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirm Modal ── */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑</div>
            <h2 className="modal-title">Delete Session?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              This will permanently delete this study session. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleCancelDelete}>Cancel</button>
              <button className="modal-save" onClick={handleConfirmDelete} style={{ background: 'linear-gradient(135deg, #f44336, #e57373)' }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="statistics-container">
        <div className="statistic-card">
          <div className="statistic-number">{weekSessions.length}</div>
          <div className="statistic-label">Total</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number">{weekSessions.filter(s => s.status === 'completed').length}</div>
          <div className="statistic-label">Completed</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number">{weekSessions.filter(s => s.status !== 'completed').length}</div>
          <div className="statistic-label">Pending</div>
        </div>
      </div>

      <div className="weekly-calendar-grid">
        {DAYS.map((day, i) => (
          <div key={day} className="calendar-day-column">
            <div className="day-column-header">
              <div>{day}</div>
              <div className="day-column-date">{formatDisplay(weekDates[i])}</div>
            </div>
            <div className="day-sessions-list">
              {weekSessions.filter(s => s.day === day).map(session => (
                <div key={session.id} className={`study-session-item ${session.status === 'completed' ? 'session-completed' : ''}`}>
                  <div className="session-time">{session.time}</div>
                  <div className="session-course">{session.course}</div>
                  <div className="session-task">{session.task}</div>
                  <div className="session-actions">
                    <button className="complete-session-button" onClick={() => handleComplete(session.id, session.courseId, session.taskId, session.status)}>✓</button>
                    <button className="delete-session-button" onClick={() => handleDeleteClick(session)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}