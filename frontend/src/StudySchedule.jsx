import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { fetchAllSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import './ScheduleAndTasks.css';

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

// Returns how many weeks dateStr is from the current week (0 = this week, 1 = next, -1 = last)
function getWeekOffset(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  const sunday = getWeekStart(0); // this week's Sunday at midnight
  const diffDays = Math.round((d - sunday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// Returns current time as "HH:MM" in 24h format
function getNowTimeStr() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export default function StudySchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(getNowTimeStr());

  // Update current time every minute for real-time validation
  useEffect(() => {
    const interval = setInterval(() => setNow(getNowTimeStr()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Dropdown data
  const [courses, setCourses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [uid, setUid] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const db = getFirestore();

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

  // Fetch all sessions — runs once auth is resolved
  useEffect(() => {
    if (!authResolved) return;
    if (!uid) return;
    let cancelled = false;
    fetchAllSessions(uid).then(data => {
      if (!cancelled) { setSchedule(data); setLoading(false); }
    }).catch(err => {
      console.error('Failed to fetch sessions:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [uid, authResolved]);

  // Fetch courses when modal opens
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

  // Fetch tasks (non-completed only) when a course is selected
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

  const handleDelete = async (id, courseId, taskId) => {
    if (!window.confirm('Delete this session?')) return;
    await deleteSession(uid, courseId, taskId, id);
    setSchedule(prev => prev.filter(s => s.id !== id));
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

    // If session is today, start time must be from now onwards
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

  // Filter by actual date range so stored weekOffset values never cause mismatches
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const weekStartStr = toStr(weekStart);
  const weekEndStr   = toStr(weekEnd);

  console.log('[Schedule] week range:', weekStartStr, '→', weekEndStr);
  console.log('[Schedule] all session dates:', schedule.map(s => s.date));

  const weekSessions = schedule.filter(s =>
    s.date >= weekStartStr && s.date <= weekEndStr
  );

  if (loading) return <p>Loading schedule...</p>;

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">Study Schedule</h1>
        <button className="add-session-button" onClick={() => setShowForm(true)}>
          + Add Session
        </button>
      </div>

      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
        <span className="week-nav-label">
          {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          <span className="week-nav-dates">{getWeekLabel(weekStart)}</span>
        </span>
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Add Session</h2>

            {/* Course Dropdown */}
            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <select
              className="modal-input"
              value={form.courseId}
              onChange={handleCourseChange}
              disabled={loadingCourses}
            >
              <option value="">
                {loadingCourses ? 'Loading courses...' : '— Select a course —'}
              </option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code && c.name ? `${c.code} – ${c.name}` : c.code || c.name || c.id}
                </option>
              ))}
            </select>

            {/* Task Dropdown */}
            <label className="modal-label">Task <span className="modal-required">*</span></label>
            <select
              className="modal-input"
              value={form.taskId}
              onChange={handleTaskChange}
              disabled={!form.courseId || loadingTasks}
            >
              <option value="">
                {!form.courseId
                  ? 'Select a course first'
                  : loadingTasks
                  ? 'Loading tasks...'
                  : tasks.length === 0
                  ? 'No tasks found for this course'
                  : '— Select a task —'}
              </option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title ?? t.name ?? t.id}
                </option>
              ))}
            </select>

            {/* Date */}
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

            {/* Time */}
            <div className="modal-row">
              <div className="modal-col">
                <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                <input
                  className="modal-input"
                  type="time"
                  value={form.startTime}
                  min={form.date === getTodayStr() ? now : undefined}
                  disabled={!form.date}
                  onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="modal-col">
                <label className="modal-label">End Time <span className="modal-required">*</span></label>
                <input
                  className="modal-input"
                  type="time"
                  value={form.endTime}
                  min={form.startTime || undefined}
                  disabled={!form.date}
                  onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
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
                <div
                  key={session.id}
                  className={`study-session-item ${session.status === 'completed' ? 'session-completed' : ''}`}
                >
                  <div className="session-time">{session.time}</div>
                  <div className="session-course">{session.course}</div>
                  <div className="session-task">{session.task}</div>
                  <div className="session-actions">
                    <button
                      className="complete-session-button"
                      onClick={() => handleComplete(session.id, session.courseId, session.taskId, session.status)}
                    >✓</button>
                    <button
                      className="delete-session-button"
                      onClick={() => handleDelete(session.id, session.courseId, session.taskId)}
                    >🗑</button>
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