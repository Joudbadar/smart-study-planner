import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { fetchSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import './ScheduleAndTasks.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_FORM = { date: '', startTime: '', endTime: '', course: '', task: '' };

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
  const todaySunday = getWeekStart(0);
  const diff = Math.round((d - todaySunday) / (7 * 24 * 60 * 60 * 1000));
  return Math.floor(diff);
}

export default function StudySchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [weekOffset, setWeekOffset] = useState(0);
  const uid = getAuth().currentUser?.uid;

  const weekStart = getWeekStart(weekOffset);
  const weekDates = getWeekDates(weekStart);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    fetchSessions(uid).then(data => {
      setSchedule(data);
      setLoading(false);
    });
  }, [uid]);

  const handleComplete = async (id, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateSession(uid, id, { status: newStatus });
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this session?")) return;
    await deleteSession(uid, id);
    setSchedule(prev => prev.filter(s => s.id !== id));
  };

  const handleAdd = async () => {
    if (!form.date)      return alert('Please pick a date.');
    if (!form.startTime) return alert('Please pick a start time.');
    if (!form.endTime)   return alert('Please pick an end time.');
    if (!form.course)    return alert('Please enter a course.');
    if (form.endTime <= form.startTime) return alert('End time must be after start time.');

    const newSession = {
      date: form.date,
      day: getDayName(form.date),
      weekOffset: getWeekOffset(form.date),
      time: `${form.startTime} - ${form.endTime}`,
      course: form.course,
      task: form.task,
      status: 'pending',
    };

    const saved = await addSession(uid, newSession);
    setSchedule(prev => [...prev, saved]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const weekSessions = schedule.filter(s => (s.weekOffset ?? 0) === weekOffset);

  if (loading) return <p>Loading schedule...</p>;

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">📅 Study Schedule</h1>
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

            <label className="modal-label">Date <span className="modal-required">*</span></label>
            <input
              className="modal-input"
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />

            <div className="modal-row">
              <div className="modal-col">
                <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                <input
                  className="modal-input"
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
              <div className="modal-col">
                <label className="modal-label">End Time <span className="modal-required">*</span></label>
                <input
                  className="modal-input"
                  type="time"
                  value={form.endTime}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <input
              className="modal-input"
              placeholder="e.g. SWE 381"
              value={form.course}
              onChange={e => setForm({ ...form, course: e.target.value })}
            />

            <label className="modal-label">Task</label>
            <input
              className="modal-input"
              placeholder="e.g. Review Chapter 3"
              value={form.task}
              onChange={e => setForm({ ...form, task: e.target.value })}
            />

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
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
                      onClick={() => handleComplete(session.id, session.status)}
                    >✓</button>
                    <button
                      className="delete-session-button"
                      onClick={() => handleDelete(session.id)}
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