import { useState } from 'react';
import './TrackCompletion.css';

export default function TrackCompletion() {

  const [studySessions, setStudySessions] = useState([
    { id: 1, name: 'Web Applications Study', status: 'pending' },
    { id: 2, name: 'Database Revision', status: 'pending' },
    { id: 3, name: 'Data Structures Practice', status: 'pending' },
    { id: 4, name: 'Calculus Problem Solving', status: 'pending' },
  ]);

  const markCompleted = (id) => {
    setStudySessions(prev =>
      prev.map(session =>
        session.id === id
          ? { ...session, status: 'completed' }
          : session
      )
    );
  };

  const markMissed = (id) => {
    setStudySessions(prev =>
      prev.map(session =>
        session.id === id
          ? { ...session, status: 'missed' }
          : session
      )
    );
  };

  const COURSE_PROGRESS = [
    { name: 'Web Applications Development', completed: 9, total: 10 },
    { name: 'Database Systems', completed: 7, total: 10 },
    { name: 'Data Structures', completed: 8, total: 10 },
    { name: 'Calculus III', completed: 6, total: 10 },
  ];

  const coursesWithPercentage = COURSE_PROGRESS.map(course => ({
    ...course,
    pct: Math.round((course.completed / course.total) * 100)
  }));

  const completedSessions = studySessions.filter(s => s.status === 'completed').length;
  const totalSessions = studySessions.length;
  const OVERALL_RATE = Math.round((completedSessions / totalSessions) * 100);

  const WEEKLY_DATA = [
    { day: 'Sun', hours: 2 },
    { day: 'Mon', hours: 4 },
    { day: 'Tue', hours: 3 },
    { day: 'Wed', hours: 5 },
    { day: 'Thu', hours: 2 },
  ];

  return (
    <main>

      <header>
        <h1 className="track-title">Progress and Analytics</h1>
        <p className="track-subtitle">
          Track your academic performance and weekly study activity.
        </p>
      </header>

      <section className="track-card">
        <h2>Overall Completion</h2>
        <div className="overall-rate">{OVERALL_RATE}% Completed</div>
        <div className="track-progress-bar">
          <div
            className="track-progress-fill"
            style={{ width: `${OVERALL_RATE}%` }}
          />
        </div>
      </section>

      {/* ===== Study Sessions ===== */}
      <section className="track-card">
        <h2>Study Sessions</h2>

        {studySessions.map(session => (
          <div key={session.id} className="track-course-item">

            <div className="track-course-info">
              <span>{session.name}</span>
              <span>{session.status}</span>
            </div>

            <div style={{ marginTop: '8px' }}>
              <button
                className="complete-btn"
                onClick={() => markCompleted(session.id)}
              >
                 Complete
              </button>

              <button
                className="miss-btn"
                onClick={() => markMissed(session.id)}
                style={{ marginLeft: '10px' }}
              >
                 Miss
              </button>
            </div>

          </div>
        ))}
      </section>

      <section className="track-card">
        <h2>Course Completion Breakdown</h2>
        {coursesWithPercentage.map(course => (
          <div key={course.name} className="track-course-item">
            <div className="track-course-info">
              <span>{course.name}</span>
              <span>{course.pct}%</span>
            </div>
            <div className="track-progress-bar">
              <div
                className="track-progress-fill"
                style={{ width: `${course.pct}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="track-card">
        <h2>Weekly Study Hours</h2>
        <div className="track-chart">
          {WEEKLY_DATA.map(day => (
            <div key={day.day} className="chart-bar">
              <div className="bar" style={{ height: `${day.hours * 30}px` }}>
                <span className="bar-value">{day.hours}h</span>
              </div>
              <span className="bar-label">{day.day}</span>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ 
        marginTop: '2rem', 
        padding: '1rem 0', 
        textAlign: 'center', 
        color: '#7a7a7a',
        fontSize: '0.9rem'
      }}>
        © 2026 Smart Study Planner | Progress & Analytics Module
      </footer>

    </main>
  );
}