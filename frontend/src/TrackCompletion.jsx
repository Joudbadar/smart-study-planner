import React, { useState, useEffect, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { fetchCourses }      from './services/CourseService';
import { fetchAllSessions }  from './services/SessionService';
import { fetchAllTasks }     from './services/TaskService';
import './TrackCompletion.css';

// ═══════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════

/** "HH:MM - HH:MM" → float hours. Returns 0 on any bad input. */
function parseSessionHours(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [a, b] = timeStr.split(' - ');
  if (!a || !b) return 0;
  const toMin = s => {
    const [h, m] = s.trim().split(':').map(Number);
    return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
  };
  const start = toMin(a), end = toMin(b);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

/** Canonical display label for a course object. */
function courseLabel(c) {
  if (!c) return '';
  const code = (c.code || '').trim();
  const name = (c.name || '').trim();
  if (code && name) return `${code} – ${name}`;
  return code || name || '';
}

/** Date → "YYYY-MM-DD" (local). */
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** "YYYY-MM-DD" → human label. */
function fmtDate(s) {
  if (!s) return '—';
  const today     = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  if (s === today)     return 'Today';
  if (s === yesterday) return 'Yesterday';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** Float hours → "2h 30m" / "45m" / "2h". */
function fmtHours(h) {
  if (!h || h <= 0) return '—';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Collapse the raw Firestore session list into one logical session per taskId.
 *
 * When a session is missed and rescheduled, Firestore holds multiple records
 * for the same unit of work (same taskId):
 *   - original    → status: "missed"
 *   - replacement → status: "rescheduled"  (may later become "completed")
 *
 * Counting all of them inflates totals. The rule applied here:
 *
 *   For each taskId keep exactly ONE record, chosen by priority:
 *     1. completed   – work was done
 *     2. rescheduled – work is planned
 *     3. pending     – work is planned
 *     4. missed      – work was not done
 *
 * Sessions with no taskId are kept as-is (cannot be deduplicated).
 *
 * FR8.1 / FR8.2: this ensures weekly hours and progress trends only reflect
 * real completed work, and session counts represent logical units of work.
 */
const STATUS_PRIORITY = { completed: 0, rescheduled: 1, pending: 2, missed: 3 };

function buildEffectiveSessions(sessions) {
  const byTaskId = new Map();

  sessions.forEach(s => {
    if (!s.taskId) return; // no taskId — handled separately below
    const existing = byTaskId.get(s.taskId);
    const sPri     = STATUS_PRIORITY[s.status] ?? 99;
    const exPri    = existing ? (STATUS_PRIORITY[existing.status] ?? 99) : Infinity;
    if (!existing || sPri < exPri) byTaskId.set(s.taskId, s);
  });

  const noTaskId = sessions.filter(s => !s.taskId);
  return [...byTaskId.values(), ...noTaskId];
}

/**
 * Consecutive-day study streak ending on today or yesterday.
 * Only counts days that have ≥1 completed session.
 */
function computeStreak(sessions) {
  const doneDays = new Set(
    sessions.filter(s => s.status === 'completed' && s.date).map(s => s.date)
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!doneDays.has(toDateStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (doneDays.has(toDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Day of week with the most completed study hours. */
function bestStudyDay(sessions) {
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const totals = {};
  sessions.filter(s => s.status === 'completed').forEach(s => {
    if (!s.date) return;
    const name = DAY_NAMES[new Date(s.date + 'T00:00:00').getDay()];
    totals[name] = (totals[name] || 0) + parseSessionHours(s.time);
  });
  const entries = Object.entries(totals);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DAY_LABELS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAILY_TARGET = 3; // hours/day target
const TABS         = ['Overview','Sessions','Courses','Tasks'];

const STATUS_META = {
  completed:   { label: 'Completed',   color: '#2e7d32', bg: '#e8f5e9' },
  pending:     { label: 'Pending',     color: '#e65100', bg: '#fff3e0' },
  missed:      { label: 'Missed',      color: '#c62828', bg: '#ffebee' },
  rescheduled: { label: 'Rescheduled', color: '#6a1de8', bg: '#ede9fe' },
};

const PRIORITY_META = {
  high:   { label: 'High',   color: '#c62828', bg: '#ffebee' },
  medium: { label: 'Medium', color: '#e65100', bg: '#fff3e0' },
  low:    { label: 'Low',    color: '#2e7d32', bg: '#e8f5e9' },
};

// Colour accents cycling through courses
const COURSE_ACCENTS = ['#e67a5f','#3b82f6','#4caf50','#ff9800','#8b5cf6','#ec4899'];

// ═══════════════════════════════════════════════════════════════
// INLINE SVG ICONS (no extra dep)
// ═══════════════════════════════════════════════════════════════
const IC = {
  Clock:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Target:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Flame:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z"/></svg>,
  CheckAll: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  TrendUp:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendDn:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Book:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  Award:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  XCircle:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  Insight:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  ChevR:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function MetricCard({ icon, iconBg, iconColor, value, label, trend, trendLabel, badge, badgeStyle }) {
  return (
    <div className="tc-metric-card">
      <div className="tc-metric-top">
        <div className="tc-metric-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        {trend === 'up'   && <span className="tc-trend up">{IC.TrendUp}{trendLabel}</span>}
        {trend === 'down' && <span className="tc-trend down">{IC.TrendDn}{trendLabel}</span>}
        {badge            && <span className="tc-trend-badge" style={badgeStyle}>{badge}</span>}
      </div>
      <div className="tc-metric-value">{value}</div>
      <div className="tc-metric-label">{label}</div>
    </div>
  );
}

function RadialRing({ pct, size = 80, stroke = 7, color = '#e67a5f' }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * circ;
  return (
    <svg width={size} height={size} style={{ overflow: 'visible', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f5ece9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, fontSize: size * 0.17, fill: '#2d2d2d' }}>
        {pct}%
      </text>
    </svg>
  );
}

function WeeklyBarChart({ data, targetVal, maxVal }) {
  return (
    <div className="tc-bar-chart">
      {data.map(({ day, hours }) => {
        const pct    = maxVal > 0 ? (hours    / maxVal) * 100 : 0;
        const tgtPct = maxVal > 0 ? (targetVal / maxVal) * 100 : 0;
        const met    = hours >= targetVal && hours > 0;
        return (
          <div key={day} className="tc-bc-col">
            <div className="tc-bc-bars">
              <div className="tc-bc-target" style={{ height: `${tgtPct}%` }} />
              <div className={`tc-bc-actual ${met ? 'met' : ''}`}
                style={{ height: `${Math.max(pct, hours > 0 ? 3 : 0)}%` }}>
                {hours > 0 && <span className="tc-bc-val">{fmtHours(hours)}</span>}
              </div>
            </div>
            <span className="tc-bc-day">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

function SessionRow({ session }) {
  const meta = STATUS_META[session.status] || STATUS_META.pending;
  return (
    <div className="tc-session-row">
      <div className="tc-session-status-dot" style={{ background: meta.color }} />
      <div className="tc-session-body">
        <span className="tc-session-task">{session.task || '—'}</span>
        <span className="tc-session-course">{session.course || '—'}</span>
      </div>
      <div className="tc-session-right">
        <span className="tc-session-time">{session.time || '—'}</span>
        <span className="tc-session-date">{fmtDate(session.date)}</span>
        <span className="tc-badge" style={{ color: meta.color, background: meta.bg }}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({ session }) {
  const done = session.status === 'completed';
  return (
    <div className="tc-activity-row">
      <div className={`tc-activity-icon ${done ? 'done' : 'miss'}`}>
        {done ? IC.CheckAll : IC.XCircle}
      </div>
      <div className="tc-activity-body">
        <span className="tc-activity-task">{session.task || '—'}</span>
        <span className="tc-activity-course">{session.course || '—'}</span>
      </div>
      <div className="tc-activity-meta">
        <span className="tc-activity-dur">{fmtHours(parseSessionHours(session.time))}</span>
        <span className="tc-activity-date">{fmtDate(session.date)}</span>
      </div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button className={`tc-filter-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TrackCompletion() {
  const [courses,       setCourses]       = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [uid,           setUid]           = useState(null);
  const [activeTab,     setActiveTab]     = useState('Overview');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [taskFilter,    setTaskFilter]    = useState('all');
  const [weekOffset,    setWeekOffset]    = useState(0);

  // ── auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), user => {
      setUid(user?.uid ?? null);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── data fetch ────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    Promise.all([fetchCourses(uid), fetchAllSessions(uid), fetchAllTasks(uid)])
      .then(([c, s, t]) => {
        if (!cancelled) {
          setCourses(c || []);
          setStudySessions(s || []);
          setTasks(t || []);
          setLoading(false);
        }
      })
      .catch(err => { console.error('TrackCompletion:', err); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  // ── effective sessions ────────────────────────────────────────
  const effectiveSessions = useMemo(
    () => buildEffectiveSessions(studySessions),
    [studySessions]
  );

  // ── overall stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTasks     = tasks.length;
    const completedTasks = tasks.filter(t => t.completed === true).length;

    const totalSessions  = effectiveSessions.length;
    const completedSess  = effectiveSessions.filter(s => s.status === 'completed').length;
    const missedSess     = effectiveSessions.filter(s => s.status === 'missed').length;
    const pendingSess    = effectiveSessions.filter(
      s => s.status === 'pending' || s.status === 'rescheduled'
    ).length;

    const totalItems     = totalTasks + totalSessions;
    const completedItems = completedTasks + completedSess;
    const overallPct     = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

    const totalStudyHours = Math.round(
      studySessions.reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
    ) / 10;
    const studiedHours = Math.round(
      studySessions.filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
    ) / 10;

    const streak  = computeStreak(studySessions);
    const bestDay = bestStudyDay(studySessions);

    // This-week goal — only completed sessions count as "studied"
    const now    = new Date();
    const sun    = new Date(now);
    sun.setDate(now.getDate() - now.getDay());
    sun.setHours(0, 0, 0, 0);
    const sunStr = toDateStr(sun);
    const satStr = toDateStr(new Date(sun.getTime() + 6 * 86400000));
    const thisWeekHours = Math.round(
      studySessions
        .filter(s => s.date >= sunStr && s.date <= satStr && s.status === 'completed')
        .reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
    ) / 10;
    const weekGoalHours = DAY_LABELS.length * DAILY_TARGET;
    const weekGoalPct   = Math.min(Math.round((thisWeekHours / weekGoalHours) * 100), 100);

    return {
      overallPct, totalTasks, completedTasks,
      totalSessions, completedSess, missedSess, pendingSess,
      totalStudyHours, studiedHours,
      streak, bestDay, thisWeekHours, weekGoalHours, weekGoalPct,
    };
  }, [tasks, studySessions, effectiveSessions]);

  // ── per-course breakdown ──────────────────────────────────────
  const courseBreakdown = useMemo(() => {
    return courses.map((course, idx) => {
      const label   = courseLabel(course);
      const accent  = COURSE_ACCENTS[idx % COURSE_ACCENTS.length];
      const cTasks  = tasks.filter(t => t.course === label || t.courseId === course.id);
      const cSess   = effectiveSessions.filter(s => s.course === label || s.courseId === course.id);
      const total     = cTasks.length + cSess.length;
      const completed =
        cTasks.filter(t => t.completed === true).length +
        cSess.filter(s => s.status === 'completed').length;
      const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
      // Hours = only completed sessions (FR8.1: weekly study hours = actual work done)
      const completedSessHours = studySessions.filter(
        s => (s.course === label || s.courseId === course.id) && s.status === 'completed'
      );
      const hours = Math.round(
        completedSessHours.reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
      ) / 10;
      return { id: course.id, name: label, accent, pct, completed, total, hours,
               taskCount: cTasks.length, sessCount: cSess.length };
    }).sort((a, b) => b.pct - a.pct);
  }, [courses, tasks, studySessions, effectiveSessions]);

  // ── weekly chart data ─────────────────────────────────────────
  const weeklyChartData = useMemo(() => {
    const now    = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);
    return DAY_LABELS.map((day, i) => {
      const d       = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = toDateStr(d);
      const allSess       = studySessions.filter(s => s.date === dateStr);
      const completedSess = allSess.filter(s => s.status === 'completed');
      // Only count completed sessions — missed/pending hours don't count as studied
      const hours = Math.round(
        completedSess.reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
      ) / 10;
      return { day, date: dateStr, hours, sessionCount: completedSess.length };
    });
  }, [studySessions, weekOffset]);

  const chartMax   = Math.max(...weeklyChartData.map(d => d.hours), DAILY_TARGET, 1);
  const chartTotal = weeklyChartData.reduce((s, d) => s + d.hours, 0);

  // ── week-specific metric card stats ─────────────────────────
  // Must match the chart exactly:
  //   • one logical session per taskId (via buildEffectiveSessions)
  //   • only completed sessions contribute to hours and "studied" count
  //   • missed sessions count as 1 logical unit (not 2 with their reschedule)
  const {
    weekTotalSess, weekCompletedSess, weekMissedSess,
    weekStudiedHours, weekGoalPct, weekGoalsMetPct,
  } = useMemo(() => {
    const weekDates       = new Set(weeklyChartData.map(d => d.date));
    // Deduplicate first, then filter to this week
    const weekEffSessions = buildEffectiveSessions(
      studySessions.filter(s => weekDates.has(s.date))
    );
    const weekTotalSess     = weekEffSessions.length;
    const weekCompletedSess = weekEffSessions.filter(s => s.status === 'completed').length;
    const weekMissedSess    = weekEffSessions.filter(s => s.status === 'missed').length;

    // Hours = only completed sessions (matches chart bars)
    const weekStudiedHours = Math.round(
      weekEffSessions
        .filter(s => s.status === 'completed')
        .reduce((sum, s) => sum + parseSessionHours(s.time), 0) * 10
    ) / 10;

    // Goal % = studied hours vs weekly target
    const weekGoalPct = Math.min(
      Math.round((weekStudiedHours / (DAY_LABELS.length * DAILY_TARGET)) * 100), 100
    );

    // Goals Met % = completed / total logical sessions this week
    const weekGoalsMetPct = weekTotalSess === 0
      ? 0 : Math.round((weekCompletedSess / weekTotalSess) * 100);

    return { weekTotalSess, weekCompletedSess, weekMissedSess,
             weekStudiedHours, weekGoalPct, weekGoalsMetPct };
  }, [weeklyChartData, studySessions]);

  const weekLabel  = weekOffset === 0  ? 'This Week'
                   : weekOffset === -1 ? 'Last Week'
                   : weekOffset === 1  ? 'Next Week'
                   : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`;

  // ── recent activity ───────────────────────────────────────────
  const recentActivity = useMemo(() =>
    [...studySessions]
      .filter(s => s.date && (s.status === 'completed' || s.status === 'missed'))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [studySessions]
  );

  // ── sessions tab ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    const list = sessionFilter === 'all'
      ? studySessions
      : studySessions.filter(s => s.status === sessionFilter);
    return [...list].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [studySessions, sessionFilter]);

  // ── tasks tab ─────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    const list = taskFilter === 'all'       ? tasks
               : taskFilter === 'completed' ? tasks.filter(t => t.completed === true)
               :                             tasks.filter(t => !t.completed);
    const order = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pa = order[a.priority] ?? 1, pb = order[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [tasks, taskFilter]);

  // ── insight text ──────────────────────────────────────────────
  const insightText = useMemo(() => {
    const parts = [];
    if (stats.bestDay)
      parts.push(`You're most productive on ${stats.bestDay}s — schedule your hardest topics then.`);
    const top = courseBreakdown[0];
    if (top && top.pct === 100)   parts.push(`${top.name} is fully completed — great work!`);
    else if (top && top.pct >= 75) parts.push(`${top.name} is ${top.pct}% done — almost there!`);
    if (stats.streak >= 3) parts.push(`${stats.streak}-day streak — keep it up!`);
    if (stats.missedSess > 0)
      parts.push(`${stats.missedSess} missed session${stats.missedSess > 1 ? 's have' : ' has'} been rescheduled automatically.`);
    return parts.length ? parts.join(' ') : 'Complete sessions to unlock personalised insights.';
  }, [stats, courseBreakdown]);

  // ─────────────────────────────────────────────────────────────
  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading Analytics...</p>;

  return (
    <div className="tc-wrapper">

      {/* ── Page Header ── */}
      <div className="tc-page-header">
        <h1 className="tc-page-title">Progress &amp; Analytics</h1>
       
      </div>

      {/* ── 4 Metric Cards ─────────────────────────────────────── */}
      <div className="tc-metrics-grid">
        <MetricCard
          icon={IC.Clock} iconBg="#ffeee6" iconColor="#e67a5f"
          value={fmtHours(weekStudiedHours)} label="Study Time"
          trend="up" trendLabel={`${weekGoalPct}% of goal`}
        />
        <MetricCard
          icon={IC.Target} iconBg="#e8f5e9" iconColor="#4caf50"
          value={`${weekGoalsMetPct}%`} label="Goals Met"
          trend="up" trendLabel={`${weekCompletedSess}/${weekTotalSess} sessions`}
        />
        <MetricCard
          icon={IC.Flame} iconBg="#fff3e0" iconColor="#ff9800"
          value={String(stats.streak)} label="Day Streak"
          badge={stats.bestDay ? `Best: ${stats.bestDay}` : null}
          badgeStyle={{ background: '#fff3e0', color: '#e65100' }}
        />
        <MetricCard
          icon={IC.CheckAll} iconBg="#ffeee6" iconColor="#e67a5f"
          value={`${weekCompletedSess}/${weekTotalSess}`} label="Sessions Done"
          trend={weekMissedSess > 0 ? 'down' : 'up'}
          trendLabel={weekMissedSess > 0 ? `${weekMissedSess} missed` : 'On track'}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="tc-tabs">
        {TABS.map(t => (
          <button key={t} className={`tc-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* ════════ OVERVIEW ════════ */}
      {activeTab === 'Overview' && (
        <div className="tc-tab-content">

          {/* Row 1: chart + achievements */}
          <div className="tc-two-col">

            {/* Weekly chart */}
            <div className="tc-card">
              <div className="tc-card-header">
                <div>
                  <h2 className="tc-card-title">Weekly Study Hours</h2>
                  <p className="tc-card-sub">Study time vs. {DAILY_TARGET}h daily target</p>
                </div>
                <div className="tc-week-nav">
                  <button className="tc-week-btn" onClick={() => setWeekOffset(o => o - 1)}>←</button>
                  <span className="tc-week-label">{weekLabel}</span>
                  <button className="tc-week-btn" onClick={() => setWeekOffset(o => o + 1)}>→</button>
                  {weekOffset !== 0 && (
                    <button className="tc-week-today" onClick={() => setWeekOffset(0)}>Today</button>
                  )}
                </div>
              </div>
              <div className="tc-chart-legend">
                <span className="tc-legend-item">
                  <span className="tc-legend-dot" style={{ background: '#e67a5f' }} /> Studied
                </span>
                <span className="tc-legend-item">
                  <span className="tc-legend-dot" style={{ background: '#f0e8e4' }} /> Target
                </span>
              </div>
              <WeeklyBarChart data={weeklyChartData} targetVal={DAILY_TARGET} maxVal={chartMax} />
              <div className="tc-chart-summary">
                <span>Total: <strong>{fmtHours(chartTotal)}</strong></span>
                <span>Goal: <strong>{fmtHours(stats.weekGoalHours)}</strong></span>
                <span>Sessions: <strong>{weeklyChartData.reduce((s,d) => s + d.sessionCount, 0)}</strong></span>
              </div>
            </div>

            {/* Achievements */}
            <div className="tc-card">
              <h2 className="tc-card-title" style={{ marginBottom: '1rem' }}>Achievements</h2>

              <div className="tc-streak-banner">
                <div className="tc-streak-icon">{IC.Flame}</div>
                <div>
                  <div className="tc-streak-val">{stats.streak} Days</div>
                  <div className="tc-streak-sub">Current Streak</div>
                </div>
              </div>

              <div className="tc-badge-grid">
                <div className={`tc-badge-item ${stats.studiedHours >= 5 ? '' : 'locked'}`}>
                  <span className="tc-badge-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>{IC.Award}</span>
                  <span className="tc-badge-name">Top Student</span>
                </div>
                <div className={`tc-badge-item ${stats.streak >= 3 ? '' : 'locked'}`}>
                  <span className="tc-badge-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>{IC.Flame}</span>
                  <span className="tc-badge-name">On Fire</span>
                </div>
                <div className={`tc-badge-item ${stats.completedTasks > 0 ? '' : 'locked'}`}>
                  <span className="tc-badge-icon" style={{ background: '#ffeee6', color: '#e67a5f' }}>{IC.Book}</span>
                  <span className="tc-badge-name">Bookworm</span>
                </div>
                <div className={`tc-badge-item ${stats.overallPct >= 80 ? '' : 'locked'}`}>
                  <span className="tc-badge-icon" style={{ background: '#ffeee6', color: '#e67a5f' }}>{IC.Target}</span>
                  <span className="tc-badge-name">Goal Crusher</span>
                </div>
              </div>

              <div className="tc-weekly-goal">
                <div className="tc-weekly-goal-header">
                  <span>Weekly Goal</span>
                  <span>{fmtHours(stats.thisWeekHours)} / {fmtHours(stats.weekGoalHours)}</span>
                </div>
                <div className="tc-prog-track">
                  <div className="tc-prog-fill"
                    style={{ width: `${stats.weekGoalPct}%`, background: '#e67a5f' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: course performance + recent activity */}
          <div className="tc-two-col">

            <div className="tc-card">
              <div className="tc-card-header">
                <h2 className="tc-card-title">Course Performance</h2>
                <button className="tc-view-all" onClick={() => setActiveTab('Courses')}>
                  View All {IC.ChevR}
                </button>
              </div>
              {courseBreakdown.length === 0
                ? <p className="tc-empty">No courses yet.</p>
                : courseBreakdown.slice(0, 4).map(c => (
                  <div key={c.id} className="tc-course-perf-row">
                    <div className="tc-course-perf-left">
                      <div className="tc-course-accent-bar" style={{ background: c.accent }} />
                      <div>
                        <div className="tc-course-perf-name">{c.name}</div>
                        <div className="tc-course-perf-meta">
                          {c.sessCount} session{c.sessCount !== 1 ? 's' : ''} · {fmtHours(c.hours)}
                        </div>
                      </div>
                    </div>
                    <div className="tc-course-perf-right">
                      <span className="tc-course-pct" style={{ color: c.accent }}>{c.pct}%</span>
                    </div>
                    <div style={{ gridColumn: '1/-1', marginTop: 6 }}>
                      <div className="tc-prog-track">
                        <div className="tc-prog-fill"
                          style={{ width: `${c.pct}%`, background: c.accent }} />
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className="tc-card">
              <div className="tc-card-header">
                <h2 className="tc-card-title">Recent Activity</h2>
                <button className="tc-view-all" onClick={() => setActiveTab('Sessions')}>
                  View All {IC.ChevR}
                </button>
              </div>
              {recentActivity.length === 0
                ? <p className="tc-empty">No activity yet.</p>
                : recentActivity.map(s => <ActivityRow key={s.id} session={s} />)
              }
            </div>
          </div>

          {/* Insight banner */}
          <div className="tc-insight-banner">
            <div className="tc-insight-icon">{IC.Insight}</div>
            <div>
              <div className="tc-insight-title">Study Insight</div>
              <p className="tc-insight-body">{insightText}</p>
            </div>
          </div>

        </div>
      )}

      {/* ════════ SESSIONS ════════ */}
      {activeTab === 'Sessions' && (
        <div className="tc-tab-content">
          <div className="tc-card">
            <div className="tc-card-header">
              <h2 className="tc-card-title">
                Study Sessions <span className="tc-count-chip">{filteredSessions.length}</span>
              </h2>
              <div className="tc-filter-row">
                {['all','completed','pending','missed','rescheduled'].map(f => (
                  <FilterBtn key={f}
                    label={f === 'all' ? 'All' : (STATUS_META[f]?.label ?? f)}
                    active={sessionFilter === f}
                    onClick={() => setSessionFilter(f)} />
                ))}
              </div>
            </div>
            {filteredSessions.length === 0
              ? <p className="tc-empty">No sessions match this filter.</p>
              : filteredSessions.map(s => <SessionRow key={s.id} session={s} />)
            }
          </div>
        </div>
      )}

      {/* ════════ COURSES ════════ */}
      {activeTab === 'Courses' && (
        <div className="tc-tab-content">
          {courseBreakdown.length === 0
            ? <div className="tc-card"><p className="tc-empty">No courses yet.</p></div>
            : (
              <>
                <div className="tc-course-radials">
                  {courseBreakdown.map(c => (
                    <div key={c.id} className="tc-course-radial-item">
                      <RadialRing pct={c.pct} color={c.accent} />
                      <span className="tc-course-radial-name">{c.name}</span>
                    </div>
                  ))}
                </div>
                {courseBreakdown.map(c => (
                  <div key={c.id} className="tc-card">
                    <div className="tc-course-detail-top">
                      <div className="tc-course-accent-bar-lg" style={{ background: c.accent }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tc-course-detail-name">{c.name}</div>
                        <div className="tc-course-detail-meta">
                          {c.taskCount} task{c.taskCount !== 1 ? 's' : ''} ·&nbsp;
                          {c.sessCount} session{c.sessCount !== 1 ? 's' : ''} ·&nbsp;
                          {fmtHours(c.hours)} scheduled
                        </div>
                      </div>
                      <RadialRing pct={c.pct} size={64} stroke={6} color={c.accent} />
                    </div>
                    <div className="tc-prog-track" style={{ marginTop: 12 }}>
                      <div className="tc-prog-fill" style={{ width: `${c.pct}%`, background: c.accent }} />
                    </div>
                    <div className="tc-course-detail-footer">
                      <span>{c.completed} completed</span>
                      <span>{c.total - c.completed} remaining</span>
                    </div>
                  </div>
                ))}
              </>
            )
          }
        </div>
      )}

      {/* ════════ TASKS ════════ */}
      {activeTab === 'Tasks' && (
        <div className="tc-tab-content">
          <div className="tc-card">
            <div className="tc-card-header">
              <h2 className="tc-card-title">
                Tasks <span className="tc-count-chip">{filteredTasks.length}</span>
              </h2>
              <div className="tc-filter-row">
                {['all','pending','completed'].map(f => (
                  <FilterBtn key={f}
                    label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    active={taskFilter === f}
                    onClick={() => setTaskFilter(f)} />
                ))}
              </div>
            </div>
            {filteredTasks.length === 0
              ? <p className="tc-empty">No tasks match this filter.</p>
              : filteredTasks.map(task => {
                  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
                  return (
                    <div key={task.id} className={`tc-task-row ${task.completed ? 'done' : ''}`}>
                      <span className={`tc-task-check ${task.completed ? 'checked' : ''}`}>
                        {task.completed ? IC.CheckAll : <span className="tc-task-circle" />}
                      </span>
                      <div className="tc-task-body">
                        <span className={`tc-task-title ${task.completed ? 'strike' : ''}`}>
                          {task.title || '—'}
                        </span>
                        <span className="tc-task-course">{task.course || '—'}</span>
                      </div>
                      <div className="tc-task-right">
                        {task.dueDate && (
                          <span className="tc-task-due">Due {fmtDate(task.dueDate)}</span>
                        )}
                        <span className="tc-badge" style={{ color: pm.color, background: pm.bg }}>
                          {pm.label}
                        </span>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      )}

    </div>
  );
}