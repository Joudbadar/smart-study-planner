import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from "./services/firebase";
import './Dashboard.css';
import Chatbot from './Chatbot';

export default function Dashboard() {
  const [todaySessions, setTodaySessions]   = useState([]);
  const [deadlines, setDeadlines]           = useState([]);
  const [courses, setCourses]               = useState([]);
  const [weekSessions, setWeekSessions]     = useState([]);
  const [chatbotOpen, setChatbotOpen]       = useState(false);
  const [loading, setLoading]               = useState(true);

  const uid  = getAuth().currentUser?.uid;
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    loadData();
  }, [uid]);

  const loadData = async () => {
    // 1. Sessions
    const sessionsSnap = await getDocs(collection(db, 'users', uid, 'sessions'));
    const allSessions  = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setTodaySessions(allSessions.filter(s => s.day === today));
    setWeekSessions(allSessions.filter(s => (s.weekOffset ?? 0) === 0));

    // 2. Tasks / Deadlines
    const tasksSnap = await getDocs(collection(db, 'users', uid, 'tasks'));
    const allTasks  = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const upcoming  = allTasks
      .filter(t => !t.completed)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 4);
    setDeadlines(upcoming);

    // 3. Courses
    const coursesSnap = await getDocs(collection(db, 'users', uid, 'courses'));
    setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    setLoading(false);
  };

  const handleComplete = async (id) => {
    await updateDoc(doc(db, 'users', uid, 'sessions', id), { status: 'completed' });
    setTodaySessions(prev => prev.map(s => s.id === id ? { ...s, status: 'completed' } : s));
  };

  const handleMiss = async (id) => {
    await updateDoc(doc(db, 'users', uid, 'sessions', id), { status: 'missed' });
    setTodaySessions(prev => prev.map(s => s.id === id ? { ...s, status: 'missed' } : s));
  };

  // ── Stats ──
  const completedSessions = weekSessions.filter(s => s.status === 'completed').length;
const completedTasks    = deadlines.filter(t => t.completed).length;
const totalSessions     = weekSessions.length;
const totalTasks        = deadlines.length;
const totalCount        = totalSessions + totalTasks;
const completedCount    = completedSessions + completedTasks;
const completionRate    = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const studyHours     = weekSessions.reduce((sum, s) => {
    if (!s.time) return sum;
    const [start, end] = s.time.split(' - ');
    if (!start || !end) return sum;
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    return sum + (toMin(end) - toMin(start)) / 60;
  }, 0);

  const STATS = [
    { icon: '⏱️', value: `${studyHours.toFixed(1)}h`, label: 'Study Hours This Week' },
    { icon: '✓',  value: `${completedCount}/${totalCount}`, label: 'Completed Sessions' },
    { icon: '📝', value: deadlines.length, label: 'Upcoming Deadlines' },
    { icon: '📈', value: `${completionRate}%`, label: 'Completion Rate' },
  ];

  // ── Deadline badge ──
  const getDueBadge = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff <= 0)  return { label: 'Today!',    urgent: true };
    if (diff === 1) return { label: 'Tomorrow',  urgent: true };
    if (diff <= 7)  return { label: `In ${diff} Days`, urgent: false };
    return { label: 'Next Week', urgent: false };
  };

  if (loading) return <p style={{ padding: '2rem' }}>Loading dashboard...</p>;

  return (
    <>
      <button className="chatbot-fab" title="AI Assistant" onClick={() => setChatbotOpen(true)}>
        💬
      </button>
      {chatbotOpen && <Chatbot onClose={() => setChatbotOpen(false)} />}

      <h1 className="page-title">Welcome! 👋</h1>
      <p className="page-subtitle">Here is your study summary for today</p>

      {/* Stats */}
      <div className="stats-grid">
        {STATS.map(({ icon, value, label }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon">{icon}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="content-grid">
        {/* Today's Schedule */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Today's Schedule</h2>
          </div>
          {todaySessions.length === 0 ? (
            <p style={{ color: '#aaa', padding: '16px' }}>No sessions scheduled for today.</p>
          ) : (
            todaySessions.map((item) => (
              <div key={item.id} className={`schedule-item ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'missed' ? 'missed' : ''}`}>
                <div className="schedule-time">{item.time}</div>
                <div className="schedule-details">
                  <div className="schedule-course">{item.course}</div>
                  <div className="schedule-type">{item.task}</div>
                </div>
                <div className="schedule-actions">
                  <button className="btn-icon btn-complete" onClick={() => handleComplete(item.id)}>done</button>
                  <button className="btn-icon btn-miss"     onClick={() => handleMiss(item.id)}>miss</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Upcoming Deadlines</h2>
          </div>
          {deadlines.length === 0 ? (
            <p style={{ color: '#aaa', padding: '16px' }}>No upcoming deadlines.</p>
          ) : (
            deadlines.map((item) => {
              const { label, urgent } = getDueBadge(item.dueDate);
              return (
                <div key={item.id} className="deadline-item">
                  <div className={`deadline-badge ${urgent ? 'urgent' : ''}`}>{label}</div>
                  <div className="deadline-details">
                    <div className="deadline-title">{item.title}</div>
                    <div className="deadline-course">{item.course}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bottom-grid">
        {/* Weekly Study Hours */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Weekly Study Hours</h2>
          </div>
          <div className="progress-chart">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, i) => {
              const daySessions = weekSessions.filter(s => s.day === DAYS[i === 0 ? 0 : i]);
              const hours = daySessions.reduce((sum, s) => {
                if (!s.time) return sum;
                const [start, end] = s.time.split(' - ');
                if (!start || !end) return sum;
                const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
                return sum + (toMin(end) - toMin(start)) / 60;
              }, 0);
              const height = hours > 0 ? `${Math.min(hours * 20, 100)}%` : '5%';
              return (
                <div key={label} className="chart-bar">
                  <div className="bar" style={{ height }}>
                    <span className="bar-value">{hours > 0 ? `${hours.toFixed(1)}h` : '0'}</span>
                  </div>
                  <span className="bar-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Course Progress */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course Progress</h2>
          </div>
          {courses.length === 0 ? (
            <p style={{ color: '#aaa', padding: '16px' }}>No courses added yet.</p>
          ) : (
            courses.map((course) => {
              const courseSessions = weekSessions.filter(s => s.course === course.code || s.course === course.name);
              const completed = courseSessions.filter(s => s.status === 'completed').length;
              const pct = courseSessions.length > 0 ? Math.round((completed / courseSessions.length) * 100) : 0;
              return (
                <div key={course.id} className="course-progress-item">
                  <div className="course-info">
                    <span className="course-name">{course.name}</span>
                    <span className="course-percentage">{pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}