import { useState } from 'react';
import './Dashboard.css';
import Chatbot from './Chatbot';

const STATS = [
  { icon: '⏱️', value: '25 Hours', label: 'Study Hours This Week' },
  { icon: '✓',  value: '12/18',   label: 'Completed Sessions'     },
  { icon: '📝', value: '3',        label: 'Upcoming Deadlines'     },
  { icon: '📈', value: '85%',      label: 'Completion Rate'        },
];

const SCHEDULE = [
  { time: '9:00 - 10:30',  course: 'Web Programming',      type: 'JavaScript Review' },
  { time: '11:00 - 12:00', course: 'Database Systems',     type: 'Solve Exercises'   },
  { time: '2:00 - 3:30',   course: 'Interaction Design',   type: 'UI/UX Study'       },
  { time: '4:00 - 5:00',   course: 'Information Security', type: 'Exam Review'       },
];

const DEADLINES = [
  { badge: 'Tomorrow',  urgent: true,  title: 'Final Project Submission', course: 'Web Programming'      },
  { badge: 'In 3 Days', urgent: false, title: 'Midterm Exam',             course: 'Database Systems'     },
  { badge: 'In 5 Days', urgent: false, title: 'Presentation',             course: 'Interaction Design'   },
  { badge: 'Next Week', urgent: false, title: 'Research Report',          course: 'Information Security' },
];

const CHART_BARS = [
  { height: '80%',  value: '4h',   label: 'Sat' },
  { height: '95%',  value: '4.5h', label: 'Sun' },
  { height: '70%',  value: '3.5h', label: 'Mon' },
  { height: '100%', value: '5h',   label: 'Tue' },
  { height: '85%',  value: '4h',   label: 'Wed' },
  { height: '75%',  value: '3.5h', label: 'Thu' },
  { height: '20%',  value: '0.5h', label: 'Fri' },
];

const COURSES = [
  { name: 'Web Programming',      pct: 92 },
  { name: 'Database Systems',     pct: 78 },
  { name: 'Interaction Design',   pct: 85 },
  { name: 'Information Security', pct: 65 },
];

export default function Dashboard() {
  const [scheduleItems, setScheduleItems] = useState(
    SCHEDULE.map(item => ({ ...item, status: 'pending' }))
  );

  // ✨ State جديد للشات بوت
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const handleComplete = (index) => {
    setScheduleItems(prev =>
      prev.map((item, i) => i === index ? { ...item, status: 'completed' } : item)
    );
    setTimeout(() => alert('Session marked as completed!'), 200);
  };

  const handleMiss = (index) => {
    setScheduleItems(prev =>
      prev.map((item, i) => i === index ? { ...item, status: 'missed' } : item)
    );
    setTimeout(() => alert('Session marked as missed.'), 200);
  };

  return (
    <>
      {/* ✨ زر الشات بوت + الكومبوننت */}
      <button 
        className="chatbot-fab" 
        title="AI Assistant"
        onClick={() => setChatbotOpen(true)}
      >
        💬
      </button>
      
      {chatbotOpen && <Chatbot onClose={() => setChatbotOpen(false)} />}

      <h1 className="page-title">Welcome! 👋</h1>
      <p className="page-subtitle">Here is your study summary for today</p>

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
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Today's Schedule</h2>
          </div>
          {scheduleItems.map((item, i) => (
            <div key={i} className={`schedule-item ${item.status === 'completed' ? 'completed' : ''} ${item.status === 'missed' ? 'missed' : ''}`}>
              <div className="schedule-time">{item.time}</div>
              <div className="schedule-details">
                <div className="schedule-course">{item.course}</div>
                <div className="schedule-type">{item.type}</div>
              </div>
              <div className="schedule-actions">
                <button className="btn-icon btn-complete" onClick={() => handleComplete(i)}>done</button>
                <button className="btn-icon btn-miss"     onClick={() => handleMiss(i)}>miss</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Upcoming Deadlines</h2>
          </div>
          {DEADLINES.map(({ badge, urgent, title, course }) => (
            <div key={title} className="deadline-item">
              <div className={`deadline-badge ${urgent ? 'urgent' : ''}`}>{badge}</div>
              <div className="deadline-details">
                <div className="deadline-title">{title}</div>
                <div className="deadline-course">{course}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bottom-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Weekly Study Hours</h2>
          </div>
          <div className="progress-chart">
            {CHART_BARS.map(({ height, value, label }) => (
              <div key={label} className="chart-bar">
                <div className="bar" style={{ height }}>
                  <span className="bar-value">{value}</span>
                </div>
                <span className="bar-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Course Progress</h2>
          </div>
          {COURSES.map(({ name, pct }) => (
            <div key={name} className="course-progress-item">
              <div className="course-info">
                <span className="course-name">{name}</span>
                <span className="course-percentage">{pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}