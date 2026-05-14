import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { fetchCourses } from './services/CourseService';
import { fetchAllSessions } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';
import './TrackCompletion.css';

export default function TrackCompletion() {
  const [courses, setCourses] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState(null);

  // Wait for Firebase Auth to restore session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([
      fetchCourses(uid),
      fetchAllSessions(uid),
      fetchAllTasks(uid),
    ]).then(([fetchedCourses, fetchedSessions, fetchedTasks]) => {
      if (!cancelled) {
        setCourses(fetchedCourses);
        setStudySessions(fetchedSessions);
        setTasks(fetchedTasks);
        setLoading(false);
      }
    }).catch(err => {
      console.error('Error fetching analytics data:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [uid]);

  if (loading) return <p style={{ textAlign: 'center', padding: '40px' }}>Loading Analytics...</p>;

  // Overall completion rate across tasks + sessions
  const totalItems     = tasks.length + studySessions.length;
  const completedItems =
    tasks.filter(t => t.completed === true).length +
    studySessions.filter(s => s.status === 'completed').length;
  const OVERALL_RATE = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  // Per-course breakdown
  const coursesWithPercentage = courses.map(course => {
    const label = course.code && course.name ? `${course.code} – ${course.name}` : course.code || course.name;
    const courseTasks    = tasks.filter(t => t.course === label);
    const courseSessions = studySessions.filter(s => s.course === label);
    const total     = courseTasks.length + courseSessions.length;
    const completed =
      courseTasks.filter(t => t.completed === true).length +
      courseSessions.filter(s => s.status === 'completed').length;
    return {
      name: label,
      pct: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });

  // Weekly study hours — computed from actual session times
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyHours = DAY_LABELS.map(dayLabel => {
    const daySessions = studySessions.filter(s => {
      const d = new Date((s.date || '') + 'T00:00:00');
      return DAY_LABELS[d.getDay()] === dayLabel;
    });
    const hours = daySessions.reduce((sum, s) => {
      if (!s.time) return sum;
      const [start, end] = s.time.split(' - ');
      if (!start || !end) return sum;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0);
    return { day: dayLabel, hours: Math.round(hours * 10) / 10 };
  });
  const maxHours = Math.max(...weeklyHours.map(d => d.hours), 1);

  return (
    <main>
      <header>
        <h1 className="track-title">Progress and Analytics</h1>
        <p className="track-subtitle">
          Track your academic performance and weekly study activity.
        </p>
      </header>

      {/* Overall Completion */}
      <section className="track-card">
        <h2>Overall Completion</h2>
        <div className="overall-rate">{OVERALL_RATE}% Completed</div>
        <div className="track-progress-bar">
          <div className="track-progress-fill" style={{ width: `${OVERALL_RATE}%` }} />
        </div>
      </section>

      {/* Study Sessions — read only */}
      <section className="track-card">
        <h2>Study Sessions</h2>
        {studySessions.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '16px 0' }}>No sessions yet.</p>
        )}
        {studySessions.map(session => (
          <div key={session.id} className="track-course-item">
            <div className="track-course-info">
              <span>{session.course} — {session.task}</span>
              <span
                className={`session-status-badge ${session.status}`}
              >
                {session.status}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
              📅 {session.date} &nbsp; 🕐 {session.time}
            </div>
          </div>
        ))}
      </section>

      {/* Course Completion Breakdown */}
      <section className="track-card">
        <h2>Course Completion Breakdown</h2>
        {coursesWithPercentage.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '16px 0' }}>No courses yet.</p>
        )}
        {coursesWithPercentage.map(course => (
          <div key={course.name} className="track-course-item">
            <div className="track-course-info">
              <span>{course.name}</span>
              <span>{course.pct}%</span>
            </div>
            <div className="track-progress-bar">
              <div className="track-progress-fill" style={{ width: `${course.pct}%` }} />
            </div>
          </div>
        ))}
      </section>

      {/* Weekly Study Hours — computed from real sessions */}
      <section className="track-card">
        <h2>Weekly Study Hours</h2>
        <div className="track-chart">
          {weeklyHours.map(day => (
            <div key={day.day} className="chart-bar">
              <div
                className="bar"
                style={{ height: `${(day.hours / maxHours) * 150}px` }}
              >
                {day.hours > 0 && <span className="bar-value">{day.hours}h</span>}
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
        fontSize: '0.9rem',
      }}>
        © 2026 Smart Study Planner | Progress & Analytics Module
      </footer>
    </main>
  );
}