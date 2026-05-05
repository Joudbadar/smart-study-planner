// StudySchedule.jsx
import './StudySchedule.css';

const schedule = [
  { id: 1, day: 'Sunday', date: 'Apr 5', time: '09:00 - 11:00', course: 'SWE 381', task: 'Complete Demo ', completed: false },
  { id: 2, day: 'Sunday', date: 'Apr 5', time: '13:00 - 15:00', course: 'SWE 321', task: 'Diagrams Tutorial', completed: false },
  { id: 4, day: 'Tuesday', date: 'Apr 8', time: '14:00 - 16:00', course: 'SWE 381', task:'', completed: false },
  { id: 5, day: 'Sunday', date: 'Apr 5', time: '11:00 - 13:00', course: 'OR100', task: ' OR HW', completed: true },
  { id: 8, day: 'Saturday', date: 'Apr 12', time: '10:00 - 12:00', course: 'SWE 381', task: 'Review Code', completed: false },
];

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudySchedule() {
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
          <div className="statistic-number">{schedule.filter(s => !s.completed).length}</div>
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
                    <button className="complete-session-button">✓</button>
                    <button className="delete-session-button">🗑</button>
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