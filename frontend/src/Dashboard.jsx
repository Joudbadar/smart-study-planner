import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from "./services/firebase";
import { fetchAllSessions, updateSession } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';
import { fetchCourses } from './services/CourseService';
import './Dashboard.css';
import Chatbot from './Chatbot';
import React from 'react';
import { Clock, CheckCircle2, FileText, TrendingUp, MessageCircle } from "lucide-react";

const DAYS       = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY      = DAYS[new Date().getDay()];

export default function Dashboard() {
  const [todaySessions, setTodaySessions] = useState([]);
  const [deadlines, setDeadlines]         = useState([]);
  const [allTasks, setAllTasks]           = useState([]);
  const [courses, setCourses]             = useState([]);
  const [allSessions, setAllSessions]     = useState([]);
  const [chatbotOpen, setChatbotOpen]     = useState(false);
  const [loading, setLoading]             = useState(true);
  const [uid, setUid]                     = useState(null);

  const loadData = async (userId) => {
    // 1. Sessions
    const sessions = await fetchAllSessions(userId);
    setAllSessions(sessions);
    setTodaySessions(sessions.filter(s => s.day === TODAY));

    // 2. Tasks
    const tasks = await fetchAllTasks(userId);
    setAllTasks(tasks);
    const upcoming = tasks
      .filter(t => !t.completed)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    setDeadlines(upcoming);

    // 3. Courses
    const coursesData = await fetchCourses(userId);
    setCourses(coursesData);

    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        loadData(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Stats
  const totalItems     = allTasks.length + allSessions.length;
  const completedItems = allTasks.filter(t => t.completed === true).length +
                         allSessions.filter(s => s.status === 'completed').length;
  const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const studyHours = allSessions
    .filter((s) => {
      if (s.status !== 'completed') return false;
      if (!s.date) return false;

      const now = new Date();
      const sunday = new Date(now);
      sunday.setDate(now.getDate() - now.getDay());
      sunday.setHours(0, 0, 0, 0);

      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      saturday.setHours(23, 59, 59, 999);

      const sessionDate = new Date(s.date + 'T00:00:00');
      return sessionDate >= sunday && sessionDate <= saturday;
    })
    .reduce((sum, s) => {
      if (!s.time) return sum;
      const [start, end] = s.time.split(' - ');
      if (!start || !end) return sum;
      const toMinutes = (time) => {
        const [h, m] = time.trim().split(':').map(Number);
        return h * 60 + (m || 0);
      };
      const duration = (toMinutes(end) - toMinutes(start)) / 60;
      return duration > 0 ? sum + duration : sum;
    }, 0);

  const STATS = [
    { icon: Clock,        value: `${studyHours.toFixed(1)}h`,                                                    label: 'Study Hours This Week' },
    { icon: CheckCircle2, value: `${allTasks.filter(t => t.completed === true).length}/${allTasks.length}`,       label: 'Completed Tasks' },
    { icon: FileText,     value: deadlines.length,                                                                label: 'Upcoming Deadlines' },
    { icon: TrendingUp,   value: `${completionRate}%`,                                                            label: 'Completion Rate' },
  ];

  const getDueBadge = (dueDate) => {
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff <= 0)  return { label: 'Today!',           urgent: true };
    if (diff === 1) return { label: 'Tomorrow',          urgent: true };
    if (diff <= 7)  return { label: `In ${diff} Days`,  urgent: false };
    return { label: 'Next Week', urgent: false };
  };

  // Weekly hours from real dates
  const weeklyHours = DAY_LABELS.map((dayLabel) => {
    const daySessions = allSessions.filter(s => {
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

  // Course Progress
  const courseProgress = courses.map(course => {
    const label = course.code && course.name
      ? `${course.code} – ${course.name}`
      : course.code || course.name;
    const courseTasks    = allTasks.filter(t =>
      t.course === label || t.course === course.name || t.course === course.code
    );
    const courseSessions = allSessions.filter(s =>
      s.course === label || s.course === course.name || s.course === course.code
    );
    const total     = courseTasks.length + courseSessions.length;
    const completed = courseTasks.filter(t => t.completed === true).length +
                      courseSessions.filter(s => s.status === 'completed').length;
    return { ...course, pct: total === 0 ? 0 : Math.round((completed / total) * 100) };
  });

  if (loading) return <p style={{ padding: '2rem' }}>Loading dashboard...</p>;

  return (
    <div className='h-full'>
      <button
        className="chatbot-fab"
        title="AI Assistant"
        onClick={() => setChatbotOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          fontSize: 0,
          color: '#fff',
        }}
      >
        <MessageCircle size={24} />
      </button>
      {chatbotOpen && <Chatbot onClose={() => setChatbotOpen(false)} />}

      <h1 className="page-title">Welcome! 👋</h1>

      <div className="stats-grid">
        {STATS.map(({ icon: Icon, value, label }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon"><Icon size={22} /></div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="content-grid">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Today's Schedule</h2></div>
          {todaySessions.length === 0 ? (
            <p style={{ color: '#aaa', padding: '16px' }}>No sessions scheduled for today.</p>
          ) : (
            todaySessions.map((item) => (
              <div
                key={item.id}
                className={`schedule-item ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'missed' ? 'missed' : ''}`}
              >
                <div className="schedule-time">{item.time}</div>
                <div className="schedule-details">
                  <div className="schedule-course">{item.course}</div>
                  <div className="schedule-type">{item.task}</div>
                </div>
                <div className="schedule-status">
                  {item.status === 'completed' && (
                    <span style={{ color: 'green', fontWeight: 600 }}>Completed</span>
                  )}
                  {item.status === 'missed' && (
                    <span style={{ color: 'red', fontWeight: 600 }}>Missed</span>
                  )}
                  {!item.status && (
                    <span style={{ color: '#aaa' }}>Scheduled</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">Upcoming Deadlines</h2></div>
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
        <div className="card">
          <div className="card-header"><h2 className="card-title">Weekly Study Hours</h2></div>
          <div className="progress-chart">
            {weeklyHours.map(({ day, hours }) => (
              <div key={day} className="chart-bar">
                <div className="bar" style={{ height: hours > 0 ? `${(hours / maxHours) * 150}px` : '4px' }}>
                  <span className="bar-value">{hours > 0 ? `${hours}h` : '0'}</span>
                </div>
                <span className="bar-label">{day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">Course Progress</h2></div>
          {courseProgress.length === 0 ? (
            <p style={{ color: '#aaa', padding: '16px' }}>No courses added yet.</p>
          ) : (
            courseProgress.map((course) => (
              <div key={course.id} className="course-progress-item">
                <div className="course-info">
                  <span className="course-name">{course.name}</span>
                  <span className="course-percentage">{course.pct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${course.pct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}