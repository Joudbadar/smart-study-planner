import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { fetchSessions, updateSession, deleteSession } from './services/SessionService';
import './ScheduleAndTasks.css';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = { day: 'Sunday', startTime: '', endTime: '', course: '', task: '' };

export default function StudySchedule() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const uid = getAuth().currentUser?.uid;

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

const handleAdd = () => {
    if (!form.startTime || !form.endTime || !form.course)
      return alert('Please fill in Start Time, End Time, and Course.');

    if (form.endTime <= form.startTime)
      return alert('End time must be after start time.');

    const newSession = {
      id: Date.now(),
      day: form.day,
      time: `${form.startTime} - ${form.endTime}`,
      course: form.course,
      task: form.task,
      status: 'pending',
    };
    setSchedule(prev => [...prev, newSession]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  if (loading) return <p>Loading schedule...</p>;

  return (
    <div className="study-schedule-wrapper">

      {/* Header */}
      <div className="schedule-header">
        <h1 className="schedule-title">📅 Study Schedule</h1>
        <button className="add-session-button" onClick={() => setShowForm(true)}>
          + Add Session
        </button>
      </div>

      {/* Add Session Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Add Session</h2>

            <label className="modal-label">Day</label>
            <select
              className="modal-input"
              value={form.day}
              onChange={e => setForm({ ...form, day: e.target.value })}
            >
              {days.map(d => <option key={d}>{d}</option>)}
            </select>

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

      {/* Statistics */}
      <div className="statistics-container">
        <div className="statistic-card">
          <div className="statistic-number">{schedule.length}</div>
          <div className="statistic-label">Total</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number">{schedule.filter(s => s.status === 'completed').length}</div>
          <div className="statistic-label">Completed</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number">{schedule.filter(s => s.status !== 'completed').length}</div>
          <div className="statistic-label">Pending</div>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="weekly-calendar-grid">
        {days.map(day => (
          <div key={day} className="calendar-day-column">
            <div className="day-column-header">{day}</div>
            <div className="day-sessions-list">
              {schedule.filter(s => s.day === day).map(session => (
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
