// imported React hooks and Firebase services
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { fetchSessions, updateSession, deleteSession } from './services/SessionService';
import './StudySchedule.css';

/*
const schedule = [
  { id: 1, day: 'Sunday', date: 'Apr 5', time: '09:00 - 11:00', course: 'SWE 381', task: 'Complete Demo ', completed: false },
  { id: 2, day: 'Sunday', date: 'Apr 5', time: '13:00 - 15:00', course: 'SWE 321', task: 'Diagrams Tutorial', completed: false },
  { id: 4, day: 'Tuesday', date: 'Apr 8', time: '14:00 - 16:00', course: 'SWE 381', task:'', completed: false },
  { id: 5, day: 'Sunday', date: 'Apr 5', time: '11:00 - 13:00', course: 'OR100', task: ' OR HW', completed: true },
  { id: 8, day: 'Saturday', date: 'Apr 12', time: '10:00 - 12:00', course: 'SWE 381', task: 'Review Code', completed: false },
];
*/

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudySchedule() {

// removed static schedule array, implemented dynamic state
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = getAuth().currentUser?.uid;

  // fetch data on mount
  useEffect(() => {
    if (!uid) return;
    fetchSessions(uid).then(data => {
      setSchedule(data);
      setLoading(false);
    });
  }, [uid]);

  // action handlers hooked to Firebase
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

  if (loading) return <p>Loading schedule...</p>;



  return (
    <div className="study-schedule-wrapper">
      <div className="schedule-header">
        <h1 className="schedule-title">📅 Study Schedule</h1>
        <button className="add-session-button">+ Add Session</button>
      </div>

      <div className="statistics-container">
        <div className="statistic-card">
          <div className="statistic-number">{schedule.length}</div>
          <div className="statistic-label">Total</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number">{schedule.filter(s => s.completed).length}</div>
          <div className="statistic-label">Completed</div>
        </div>
        <div className="statistic-card">
          {/*}
          <div className="statistic-number">{schedule.filter(s => !s.completed).length}</div>
          */}
          <div className="statistic-number">{schedule.filter(s => s.status === 'completed').length}</div>
          <div className="statistic-label">Pending</div>
        </div>
      </div>

      <div className="weekly-calendar-grid">
        {days.map(day => (
          <div key={day} className="calendar-day-column">
            <div className="day-column-header">{day}</div>
            <div className="day-sessions-list">
              {schedule.filter(s => s.day === day).map(session => (
                <div key={session.id} className={`study-session-item ${session.completed ? 'session-completed' : ''}`}>
                  <div className="session-time">{session.time}</div>
                  <div className="session-course">{session.course}</div>
                  <div className="session-task">{session.task}</div>
                  <div className="session-actions">
                    
                    {/*
                    <button className="complete-session-button">✓</button>
                    <button className="delete-session-button">🗑</button>
                    */}

                    <button className="complete-session-button" onClick={() => handleComplete(session.id, session.status)}>✓</button>
                    <button className="delete-session-button" onClick={() => handleDelete(session.id)}>🗑</button>


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