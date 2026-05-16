import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchAllSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';
import './ScheduleAndTasks.css';
import './StudySchedule.css';

const DAYS       = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const hour  = i + 8;
  const label = hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  return { hour, label };
});

// ── Default availability: all 7 days, no slots marked available ─
function buildDefaultAvailability() {
  return DAYS.map(day => ({ day, slots: [] }));
}

// ── Helpers ────────────────────────────────────────────────────
function getWeekStart(offset = 0) {
  const today  = new Date();
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

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr() { return toStr(new Date()); }

function getNowMin() {
  const t = new Date();
  return t.getHours() * 60 + t.getMinutes();
}

function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToStr(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function getDateForDayInWeek(dayName, wkOffset = 0) {
  const weekStart = getWeekStart(wkOffset);
  const idx = DAYS.indexOf(dayName);
  const d   = new Date(weekStart);
  d.setDate(weekStart.getDate() + idx);
  return toStr(d);
}

function getWeekOffset(dateStr) {
  const d       = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  const sunday  = getWeekStart(0);
  const diffDays = Math.round((d - sunday) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

function formatTime(timeStr) {
  const hour = parseInt(timeStr.split(':')[0]);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h    = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${ampm}`;
}

// FR4.2: Check if a given day+hour (1-hour block) is inside any available slot
function hourIsAvailable(availability, dayName, hour) {
  const day = availability.find(d => d.day === dayName);
  if (!day?.slots?.length) return false;
  const blockStart = hour * 60;
  const blockEnd   = (hour + 1) * 60;
  return day.slots.some(s =>
    s.available &&
    timeToMin(s.startTime) <= blockStart &&
    blockEnd <= timeToMin(s.endTime)
  );
}

// Build busy-time list for a date from a session array
function buildBusy(sessions, dateStr) {
  return sessions
    .filter(s => s.date === dateStr)
    .map(s => {
      const [st, en] = s.time.split(' - ');
      return { start: timeToMin(st), end: timeToMin(en) };
    })
    .sort((a, b) => a.start - b.start);
}

// ── FR5.1 / FR5.2 / FR7.2 Core scheduler ──────────────────────
// Schedules ALL tasks, placing as many 1-hour sessions as needed
// (up to a per-task cap) to cover each task's estimated study time.
// Sessions are only placed inside defined availability windows (FR4.2).
function scheduleTasks(pendingTasks, availability, existingSessions, weeksAhead = 2) {
  const today  = getTodayStr();
  const nowMin = getNowMin();
  const planned = [];

  for (const task of pendingTasks) {
    // FR5.2: determine how many 1-hr sessions this task needs
    const hoursNeeded = task.estimatedHours
      ? Math.max(1, Math.round(task.estimatedHours))
      : 1;
    let placed = 0;

    outer:
    for (let wk = 0; wk < weeksAhead; wk++) {
      // FR5.2: order by day so earlier days are preferred
      const daysOrdered = [...availability].filter(d => d.slots?.some(s => s.available));

      for (const availDay of daysOrdered) {
        const dateStr = getDateForDayInWeek(availDay.day, wk);

        // FR4.2: never schedule outside defined availability or past due date
        if (dateStr < today) continue;
        if (task.dueDate && dateStr > task.dueDate) continue;

        for (const slot of availDay.slots.filter(s => s.available)) {
          const slotStart = timeToMin(slot.startTime);
          const slotEnd   = timeToMin(slot.endTime);

          const busy = buildBusy(existingSessions, dateStr)
            .concat(
              planned
                .filter(p => p.date === dateStr)
                .map(p => ({ start: timeToMin(p.startStr), end: timeToMin(p.endStr) }))
            )
            .sort((a, b) => a.start - b.start);

          let cursor = slotStart;
          if (dateStr === today) {
            const nextHour = Math.ceil(nowMin / 60) * 60;
            if (cursor < nextHour) cursor = nextHour;
          }

          // Fill as many 1-hour blocks as possible from this slot
          while (cursor + 60 <= slotEnd && placed < hoursNeeded) {
            const end      = cursor + 60;
            const conflict = busy.find(b => !(end <= b.start || cursor >= b.end));
            if (conflict) { cursor = conflict.end; continue; }

            planned.push({
              task,
              date:     dateStr,
              day:      availDay.day,
              startStr: minToStr(cursor),
              endStr:   minToStr(end),
            });
            // Treat newly placed block as busy for next iteration
            busy.push({ start: cursor, end });
            busy.sort((a, b) => a.start - b.start);
            cursor = end;
            placed++;
          }
        }

        if (placed >= hoursNeeded) break outer;
      }
    }
  }

  return planned;
}

// ── Component ──────────────────────────────────────────────────
export default function StudySchedule() {
  const [schedule, setSchedule]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [weekOffset, setWeekOffset]         = useState(0);
  const [uid, setUid]                       = useState(null);
  const [authResolved, setAuthResolved]     = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [generateMsg, setGenerateMsg]       = useState('');
  const [rescheduling, setRescheduling]     = useState(false);
  const [autoReschedule, setAutoReschedule] = useState(true);
  const [showAvailability, setShowAvailability] = useState(false);
  // FR4.1: initialise with all 7 days so every day is always editable
  const [availability, setAvailability]     = useState(buildDefaultAvailability());
  const [savingAvail, setSavingAvail]       = useState(false);
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [confirmSession, setConfirmSession] = useState(null);

  // Use refs so async functions always see latest values without stale closures
  const scheduleRef        = useRef([]);
  const availabilityRef    = useRef(buildDefaultAvailability());
  const uidRef             = useRef(null);
  const autoRescheduleRef  = useRef(true);

  const db = getFirestore();

  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { availabilityRef.current = availability; }, [availability]);
  useEffect(() => { uidRef.current = uid; }, [uid]);
  useEffect(() => { autoRescheduleRef.current = autoReschedule; }, [autoReschedule]);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), user => {
      setUid(user?.uid ?? null);
      setAuthResolved(true);
      if (!user) setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load sessions
  useEffect(() => {
    if (!authResolved || !uid) return;
    let cancelled = false;
    fetchAllSessions(uid).then(data => {
      if (!cancelled) { setSchedule(data); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, authResolved]);

  // FR4.1: Load saved availability; merge with default so all 7 days are always present
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid, 'settings', 'weeklyAvailability')).then(snap => {
      if (snap.exists()) {
        const saved = snap.data().availability || [];
        // Ensure every day exists (merge saved slots into the full-day scaffold)
        setAvailability(buildDefaultAvailability().map(defaultDay => {
          const found = saved.find(s => s.day === defaultDay.day);
          return found ? { ...defaultDay, slots: found.slots || [] } : defaultDay;
        }));
      }
      // If no saved doc, keep the default (all days, no slots) — user can define from scratch
    });
  }, [uid]);

  // FR7.1 / FR7.2: Auto-reschedule missed sessions after initial load
  useEffect(() => {
    if (!uid || loading || schedule.length === 0) return;
    if (autoRescheduleRef.current) {
      doRescheduleMissed(schedule);
    }
  }, [uid, loading]); // run once after first load

  // ── Load availability + tasks fresh (no stale closures) ──────
  const loadAvailAndTasks = async () => {
    const currentUid = uidRef.current;
    const snap = await getDoc(doc(db, 'users', currentUid, 'settings', 'weeklyAvailability'));

    // FR4.1: build base scaffold so all 7 days are available to the scheduler
    const base = buildDefaultAvailability();
    const avail = snap.exists()
      ? base.map(d => {
          const saved = (snap.data().availability || []).find(s => s.day === d.day);
          return saved ? { ...d, slots: saved.slots || [] } : d;
        })
      : base;

    const allTasks = await fetchAllTasks(currentUid);
    // FR5.2: include all incomplete tasks (with or without a due date)
    const tasks = allTasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        const pd = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pd !== 0) return pd;
        // tasks without a due date go last
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

    return { avail, tasks };
  };

  // ── FR5.1 / FR5.2: Generate full study plan ───────────────────
  const generateFullPlan = async () => {
    const currentUid = uidRef.current;
    if (!currentUid) return;
    setGenerating(true);
    setGenerateMsg('');

    try {
      const { avail, tasks } = await loadAvailAndTasks();
      // FR4.2: only use days that have at least one available slot
      const availDays = avail.filter(d => d.slots?.some(s => s.available));

      if (availDays.length === 0) {
        setGenerateMsg('⚠️ No available days found. Update your Weekly Availability first.');
        return;
      }
      if (tasks.length === 0) {
        setGenerateMsg('⚠️ No pending tasks found. Add tasks in Tasks & Deadlines first.');
        return;
      }

      // Delete existing pending/rescheduled sessions so we start fresh
      const toDelete = scheduleRef.current.filter(s => s.status === 'pending' || s.status === 'rescheduled');
      for (const s of toDelete) {
        await deleteSession(currentUid, s.courseId, s.taskId, s.id);
      }
      // Keep only completed and missed sessions (they occupy real time slots)
      const kept = scheduleRef.current.filter(s => s.status === 'completed' || s.status === 'missed');
      setSchedule(kept);
      scheduleRef.current = kept;

      // FR5.2: Schedule fresh — respect existing busy slots, deadline, priority, course load
      const planned = scheduleTasks(tasks, availDays, kept, 2);

      if (planned.length === 0) {
        setGenerateMsg('⚠️ No free slots found in your availability. Try updating your Weekly Availability.');
        return;
      }

      const saved = [];
      for (const { task, date, day, startStr, endStr } of planned) {
        const s = await addSession(currentUid, task.courseId, task.id, {
          date, day, weekOffset: getWeekOffset(date),
          time: `${startStr} - ${endStr}`,
          course: task.course || '', task: task.title || '', status: 'pending',
          priority: task.priority || 'medium',
        });
        saved.push(s);
      }

      setSchedule(prev => {
        const updated = [...prev, ...saved];
        scheduleRef.current = updated;
        return updated;
      });
      setGenerateMsg(`✅ Scheduled ${saved.length} session(s) across ${[...new Set(planned.map(p => p.date))].length} day(s).`);
    } catch (err) {
      console.error('Generate error:', err);
      setGenerateMsg('❌ Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── FR7.1 / FR7.2: Reschedule missed sessions ─────────────────
  const doRescheduleMissed = async (currentSchedule) => {
    const currentUid = uidRef.current;
    if (!currentUid) return;
    setRescheduling(true);

    try {
      const today   = getTodayStr();
      const nowMin  = getNowMin();
      const src     = currentSchedule ?? scheduleRef.current;

      // FR7.1: detect all sessions that were missed (past due, not completed)
      const missed = src.filter(s => {
        if (s.status === 'completed' || s.status === 'missed') return false;
        if (s.date < today) return true;
        if (s.date === today) {
          const [, en] = s.time.split(' - ');
          return timeToMin(en) <= nowMin;
        }
        return false;
      });

      if (missed.length === 0) return;

      // Load fresh availability (FR4.2 compliance for rescheduled sessions)
      const snap = await getDoc(doc(db, 'users', currentUid, 'settings', 'weeklyAvailability'));
      const base  = buildDefaultAvailability();
      const avail = snap.exists()
        ? base.map(d => {
            const saved = (snap.data().availability || []).find(s => s.day === d.day);
            return saved ? { ...d, slots: saved.slots || [] } : d;
          })
        : base;
      const availDays = avail.filter(d => d.slots?.some(s => s.available));
      if (availDays.length === 0) return;

      // FR7.1: mark all detected missed sessions in Firestore
      const nonMissed = src.filter(s => !missed.find(m => m.id === s.id));
      for (const m of missed) {
        await updateSession(currentUid, m.courseId, m.taskId, m.id, { status: 'missed' });
      }

      // FR7.2: build task objects from missed sessions and reschedule them
      const missedAsTasks = missed.map(m => ({
        id: m.taskId, courseId: m.courseId,
        title: m.task, course: m.course,
        priority: m.priority || 'medium',
        estimatedHours: m.estimatedHours || 1,
        dueDate: null, // no due-date constraint — keep student on track regardless
        completed: false,
      }));

      // FR7.2: schedule into future available slots only (FR4.2)
      const planned = scheduleTasks(missedAsTasks, availDays, nonMissed, 3);

      const rescheduled = [];
      for (const { task, date, day, startStr, endStr } of planned) {
        const s = await addSession(currentUid, task.courseId, task.id, {
          date, day, weekOffset: getWeekOffset(date),
          time: `${startStr} - ${endStr}`,
          course: task.course || '', task: task.title || '',
          status: 'rescheduled',
          priority: task.priority || 'medium',
        });
        rescheduled.push(s);
      }

      // FR7.2: update local state — missed marked, new sessions appended
      setSchedule(() => {
        const updated = [
          ...src.map(s => missed.find(m => m.id === s.id) ? { ...s, status: 'missed' } : s),
          ...rescheduled,
        ];
        scheduleRef.current = updated;
        return updated;
      });
    } catch (err) {
      console.error('Reschedule error:', err);
    } finally {
      setRescheduling(false);
    }
  };

  // FR7.1 / FR7.2: Mark one session as missed and reschedule if auto-reschedule is on
  const markAsMissed = async (session) => {
    const currentUid = uidRef.current;
    await updateSession(currentUid, session.courseId, session.taskId, session.id, { status: 'missed' });
    const updated = scheduleRef.current.map(s => s.id === session.id ? { ...s, status: 'missed' } : s);
    setSchedule(updated);
    scheduleRef.current = updated;
    // FR7.2: always reschedule immediately when manually marking missed
    await doRescheduleMissed(updated);
  };

  // ── FR4.1: Save availability and regenerate plan ──────────────
  const saveAvailability = async () => {
    const currentUid = uidRef.current;
    if (!currentUid) return;
    setSavingAvail(true);
    try {
      await setDoc(doc(db, 'users', currentUid, 'settings', 'weeklyAvailability'), {
        availability, updatedAt: new Date().toISOString(),
      });
      availabilityRef.current = availability;
      setShowAvailability(false);
      // FR5.1 / FR5.2: regenerate plan with updated availability
      await generateFullPlan();
    } finally {
      setSavingAvail(false);
    }
  };

  // FR4.1: Toggle a 1-hour block in the availability grid
  // Works for ALL days, including days that had no prior slots
  const toggleSlot = (dayName, hour) => {
    setAvailability(prev => {
      const blockStart = minToStr(hour * 60);
      const blockEnd   = minToStr((hour + 1) * 60);

      return prev.map(d => {
        if (d.day !== dayName) return d;

        // Check if this exact 1-hour block already exists as a slot
        const slotIdx = d.slots.findIndex(s =>
          timeToMin(s.startTime) === hour * 60 &&
          timeToMin(s.endTime)   === (hour + 1) * 60
        );

        if (slotIdx !== -1) {
          // Toggle existing slot's available flag
          return {
            ...d,
            slots: d.slots.map((s, si) =>
              si === slotIdx ? { ...s, available: !s.available } : s
            ),
          };
        }

        // Check if this hour falls inside an existing larger slot
        const containerIdx = d.slots.findIndex(s =>
          timeToMin(s.startTime) <= hour * 60 &&
          (hour + 1) * 60 <= timeToMin(s.endTime)
        );

        if (containerIdx !== -1) {
          // Toggle the whole containing slot
          return {
            ...d,
            slots: d.slots.map((s, si) =>
              si === containerIdx ? { ...s, available: !s.available } : s
            ),
          };
        }

        // No existing slot — create a new 1-hour available slot for this day
        return {
          ...d,
          slots: [...d.slots, { startTime: blockStart, endTime: blockEnd, available: true }],
        };
      });
    });
  };

  // ── Complete / delete ─────────────────────────────────────────
  const handleComplete = async (id, courseId, taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateSession(uidRef.current, courseId, taskId, id, { status: newStatus });
    setSchedule(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const handleDeleteClick   = (session) => { setConfirmSession(session); setConfirmOpen(true); };
  const handleCancelDelete  = () => { setConfirmOpen(false); setConfirmSession(null); };
  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    await deleteSession(uidRef.current, confirmSession.courseId, confirmSession.taskId, confirmSession.id);
    setSchedule(prev => prev.filter(s => s.id !== confirmSession.id));
    setConfirmSession(null);
  };

  // ── Render ────────────────────────────────────────────────────
  const weekStart    = getWeekStart(weekOffset);
  const weekDates    = getWeekDates(weekStart);
  const weekEnd      = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = toStr(weekStart);
  const weekEndStr   = toStr(weekEnd);
  const weekSessions = schedule.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
  const todayStr     = getTodayStr();

  const getSessionsForSlot = (date, hour) => {
    const dateStr = toStr(date);
    return weekSessions.filter(s => {
      const [st] = s.time.split(' - ');
      return s.date === dateStr && parseInt(st.split(':')[0]) === hour;
    });
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high':   return { borderColor: '#f44336', background: '#ffebee' };
      case 'medium': return { borderColor: '#ff9800', background: '#fff3e0' };
      case 'low':    return { borderColor: '#4caf50', background: '#e8f5e9' };
      default:       return { borderColor: '#e67a5f', background: '#fef6f4' };
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'completed')   return { label: 'Done',        color: '#4caf50', bg: '#e8f5e9' };
    if (status === 'missed')      return { label: 'Missed',      color: '#f44336', bg: '#ffebee' };
    if (status === 'rescheduled') return { label: 'Rescheduled', color: '#ff9800', bg: '#fff3e0' };
    return null;
  };

  const completedCount = weekSessions.filter(s => s.status === 'completed').length;
  const pendingCount   = weekSessions.filter(s => s.status !== 'completed' && s.status !== 'missed').length;
  const missedCount    = weekSessions.filter(s => s.status === 'missed').length;

  if (loading) return <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Loading schedule...</p>;

  return (
    <div className="study-schedule-wrapper">

      {/* Header */}
      <div className="schedule-header">
        <h1 className="schedule-title">Study Schedule</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {rescheduling && <span style={{ fontSize: '13px', color: '#888' }}>⏳ Rescheduling...</span>}

          {/* FR7.1 / FR7.2: Auto-reschedule toggle */}
          <label className="ss-toggle-wrapper" onClick={() => setAutoReschedule(v => !v)}>
            <div className="ss-toggle-track" style={{ background: autoReschedule ? 'linear-gradient(135deg, #e67a5f, #ee9b85)' : '#ddd' }}>
              <div className="ss-toggle-thumb" style={{ left: autoReschedule ? '18px' : '3px' }} />
            </div>
            Auto-reschedule
          </label>

          {/* FR4.1: Edit availability */}
          <button className="add-session-button" style={{ background: '#f0f0f0', color: '#555' }}
            onClick={() => setShowAvailability(v => !v)}>
            🕐 {showAvailability ? 'Hide' : 'Edit'} Availability
          </button>

          {/* FR5.1: Generate plan */}
          <button className="add-session-button" onClick={() => generateFullPlan()} disabled={generating}
            style={{ background: 'linear-gradient(135deg, #e67a5f, #ee9b85)', opacity: generating ? 0.7 : 1 }}>
            {generating ? '⏳ Generating...' : '✨ Generate Plan'}
          </button>
        </div>
      </div>

      {/* Message banner */}
      {generateMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: '10px', marginBottom: '16px',
          fontSize: '13px', fontWeight: '600',
          background: generateMsg.startsWith('✅') ? '#e8f5e9' : '#fff3e0',
          color:      generateMsg.startsWith('✅') ? '#2e7d32' : '#e65100',
        }}>
          {generateMsg}
        </div>
      )}

      {/* FR4.1: Availability editor — all 7 days always shown */}
      {showAvailability && (
        <div className="ss-avail-panel">
          <div className="ss-avail-panel-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#2d2d2d' }}>Weekly Availability</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>
                Click any slot to mark yourself available. Save to update your plan.
              </p>
            </div>
            <button className="add-session-button" onClick={saveAvailability} disabled={savingAvail}
              style={{ background: 'linear-gradient(135deg, #e67a5f, #ee9b85)' }}>
              {savingAvail ? 'Saving...' : '✓ Save & Regenerate'}
            </button>
          </div>

          {/* FR4.1: Grid always shows all 7 days × 13 time slots */}
          <div className="ss-avail-grid">
            <div />
            {DAYS_SHORT.map(d => (
              <div key={d} className="ss-avail-day-header">{d}</div>
            ))}
            {TIME_SLOTS.map(slot => (
              <React.Fragment key={slot.hour}>
                <div className="ss-avail-time-label">{slot.label}</div>
                {DAYS.map(day => {
                  const avail = hourIsAvailable(availability, day, slot.hour);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleSlot(day, slot.hour)}
                      title={`${day} ${slot.label} — click to ${avail ? 'remove' : 'add'} availability`}
                      style={{
                        height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: avail ? '#ffeee6' : '#f5f5f5',
                        borderLeft: `3px solid ${avail ? '#e67a5f' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="ss-legend" style={{ justifyContent: 'flex-start', marginTop: '12px' }}>
            <div className="ss-legend-item">
              <div className="ss-legend-dot" style={{ background: '#ffeee6', borderLeft: '3px solid #e67a5f' }} /> Available
            </div>
            <div className="ss-legend-item">
              <div className="ss-legend-dot" style={{ background: '#f5f5f5', borderLeft: '3px solid transparent' }} /> Unavailable
            </div>
          </div>
        </div>
      )}

      {/* Week nav */}
      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span className="week-nav-label" style={{ padding: 0 }}>
            {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          </span>
          <span className="week-nav-dates">{formatDisplay(weekStart)} – {formatDisplay(weekEnd)}</span>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} style={{ fontSize: '11px', color: '#e67a5f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Back to Today
            </button>
          )}
        </div>
        <button className="week-nav-btn" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
      </div>

      {/* Stats */}
      <div className="statistics-container">
        <div className="statistic-card">
          <div className="statistic-number">{weekSessions.length}</div>
          <div className="statistic-label">Total Sessions</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number" style={{ color: '#4caf50' }}>{completedCount}</div>
          <div className="statistic-label">Completed</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number" style={{ color: '#e67a5f' }}>{pendingCount}</div>
          <div className="statistic-label">Upcoming</div>
        </div>
        <div className="statistic-card">
          <div className="statistic-number" style={{ color: '#f44336' }}>{missedCount}</div>
          <div className="statistic-label">Missed</div>
        </div>
      </div>

      {/* Time-grid calendar */}
      <div className="ss-calendar">
        <div className="ss-calendar-scroll">
          <div className="ss-calendar-inner">

            {/* Day headers */}
            <div className="ss-day-headers">
              <div style={{ borderRight: '1px solid #f5ece9' }} />
              {weekDates.map((date, i) => {
                const isToday = toStr(date) === todayStr;
                return (
                  <div key={i} className={`ss-day-header-cell ${isToday ? 'today' : ''}`}>
                    <div className="ss-day-short">{DAYS_SHORT[i]}</div>
                    <div className={`ss-day-number ${isToday ? 'today' : ''}`}>{date.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            <div className="ss-time-body">
              {TIME_SLOTS.map(slot => (
                <div key={slot.hour} className="ss-time-row">
                  <div className="ss-time-label">{slot.label}</div>
                  {weekDates.map((date, dayIdx) => {
                    const sessions = getSessionsForSlot(date, slot.hour);
                    const avail    = hourIsAvailable(availability, DAYS[dayIdx], slot.hour);
                    const isToday  = toStr(date) === todayStr;
                    return (
                      <div key={dayIdx} className={`ss-time-cell ${isToday && sessions.length === 0 ? 'today-col' : ''} ${!avail && sessions.length === 0 ? 'unavailable' : ''}`}>
                        {sessions.map(session => {
                          const ps      = getPriorityStyle(session.priority);
                          const badge   = getStatusBadge(session.status);
                          const isDone  = session.status === 'completed';
                          const isMiss  = session.status === 'missed';
                          return (
                            <div key={session.id} className={`ss-session-card ${isDone ? 'completed' : ''} ${isMiss ? 'missed' : ''}`}
                              style={{ borderColor: ps.borderColor, background: ps.background }}>
                              <div className={`ss-session-title ${isDone ? 'done' : ''}`}>{session.task}</div>
                              <div className="ss-session-course">{session.course}</div>
                              <div className="ss-session-time-label" style={{ color: ps.borderColor }}>
                                {formatTime(session.time.split(' - ')[0])}
                              </div>
                              {badge && (
                                <span className="ss-status-badge" style={{ background: badge.bg, color: badge.color }}>
                                  {badge.label}
                                </span>
                              )}
                              {!isDone && !isMiss && (
                                <div className="ss-action-btns">
                                  <button className="ss-action-btn ss-btn-complete" title="Mark complete"
                                    onClick={() => handleComplete(session.id, session.courseId, session.taskId, session.status)}>✓</button>
                                  <button className="ss-action-btn ss-btn-missed" title="Mark as missed"
                                    onClick={() => markAsMissed(session)}>✕</button>
                                  <button className="ss-action-btn ss-btn-delete" title="Delete"
                                    onClick={() => handleDeleteClick(session)}>🗑</button>
                                </div>
                              )}
                              {isDone && (
                                <button className="ss-undo-btn"
                                  onClick={() => handleComplete(session.id, session.courseId, session.taskId, session.status)}>
                                  Undo
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="ss-legend">
        {[['#f44336', '#ffebee', 'High Priority'], ['#ff9800', '#fff3e0', 'Medium Priority'], ['#4caf50', '#e8f5e9', 'Low Priority']].map(([color, bg, label]) => (
          <div key={label} className="ss-legend-item">
            <div className="ss-legend-dot" style={{ background: bg, borderLeft: `4px solid ${color}` }} />
            {label}
          </div>
        ))}
      </div>

      {/* Delete Confirm Modal */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑</div>
            <h2 className="modal-title">Delete Session?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              This will permanently delete this study session. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleCancelDelete}>Cancel</button>
              <button className="modal-save" onClick={handleConfirmDelete} style={{ background: 'linear-gradient(135deg, #f44336, #e57373)' }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}