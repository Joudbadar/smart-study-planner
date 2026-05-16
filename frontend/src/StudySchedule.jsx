import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchAllSessions, addSession, updateSession, deleteSession } from './services/SessionService';
import { fetchAllTasks } from './services/TaskService';

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
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr);
  const min  = minStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h    = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return min === '00' ? `${h} ${ampm}` : `${h}:${min} ${ampm}`;
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
function scheduleTasks(pendingTasks, availability, existingSessions, weeksAhead = 2) {
  const today  = getTodayStr();
  const nowMin = getNowMin();
  const planned = [];

  for (const task of pendingTasks) {
    const hoursNeeded = task.estimatedHours
      ? Math.max(1, Math.round(task.estimatedHours))
      : 1;
    let placed = 0;

    outer:
    for (let wk = 0; wk < weeksAhead; wk++) {
      const daysOrdered = [...availability].filter(d => d.slots?.some(s => s.available));

      for (const availDay of daysOrdered) {
        const dateStr = getDateForDayInWeek(availDay.day, wk);

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
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability]     = useState(buildDefaultAvailability());
  const [savingAvail, setSavingAvail]       = useState(false);
  // Unified confirm modal: action = 'complete' | 'missed' | 'delete'
  const [modalAction, setModalAction] = useState(null); // { action, session }

  const scheduleRef        = useRef([]);
  const availabilityRef    = useRef(buildDefaultAvailability());
  const uidRef             = useRef(null);

  const db = getFirestore();

  useEffect(() => { scheduleRef.current = schedule; }, [schedule]);
  useEffect(() => { availabilityRef.current = availability; }, [availability]);
  useEffect(() => { uidRef.current = uid; }, [uid]);

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
        setAvailability(buildDefaultAvailability().map(defaultDay => {
          const found = saved.find(s => s.day === defaultDay.day);
          return found ? { ...defaultDay, slots: found.slots || [] } : defaultDay;
        }));
      }
    });
  }, [uid]);

  // FR7.1 / FR7.2: Auto-reschedule missed sessions after initial load
  useEffect(() => {
    if (!uid || loading || schedule.length === 0) return;
    doRescheduleMissed(schedule);
  }, [uid, loading]); // run once after first load

  // ── Load availability + tasks fresh (no stale closures) ──────
  const loadAvailAndTasks = async () => {
    const currentUid = uidRef.current;
    const snap = await getDoc(doc(db, 'users', currentUid, 'settings', 'weeklyAvailability'));

    const base = buildDefaultAvailability();
    const avail = snap.exists()
      ? base.map(d => {
          const saved = (snap.data().availability || []).find(s => s.day === d.day);
          return saved ? { ...d, slots: saved.slots || [] } : d;
        })
      : base;

    const allTasks = await fetchAllTasks(currentUid);
    const tasks = allTasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        const pd = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pd !== 0) return pd;
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
      const availDays = avail.filter(d => d.slots?.some(s => s.available));

      if (availDays.length === 0) {
        setGenerateMsg('⚠️ No available days found. Update your Weekly Availability first.');
        return;
      }
      if (tasks.length === 0) {
        setGenerateMsg('⚠️ No pending tasks found. Add tasks in Tasks & Deadlines first.');
        return;
      }

      const toDelete = scheduleRef.current.filter(s => s.status === 'pending' || s.status === 'rescheduled');
      for (const s of toDelete) {
        await deleteSession(currentUid, s.courseId, s.taskId, s.id);
      }
      const kept = scheduleRef.current.filter(s => s.status === 'completed' || s.status === 'missed');
      setSchedule(kept);
      scheduleRef.current = kept;

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
  const doRescheduleMissed = async (currentSchedule, explicitMissed = null) => {
    const currentUid = uidRef.current;
    if (!currentUid) return;
    setRescheduling(true);

    try {
      const today   = getTodayStr();
      const nowMin  = getNowMin();
      const src     = currentSchedule ?? scheduleRef.current;

      const missed = explicitMissed ?? src.filter(s => {
        if (s.status === 'completed' || s.status === 'missed') return false;
        if (s.date < today) return true;
        if (s.date === today) {
          const [, en] = s.time.split(' - ');
          return timeToMin(en) <= nowMin;
        }
        return false;
      });

      if (missed.length === 0) return;

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

      for (const m of missed) {
        if (m.status !== 'missed') {
          await updateSession(currentUid, m.courseId, m.taskId, m.id, { status: 'missed' });
        }
      }

      const missedIds = new Set(missed.map(m => m.id));
      const nonMissed = src.filter(s => !missedIds.has(s.id));

      // Block the missed sessions' original slots so the scheduler never
      // reschedules back into the exact same time — the user already missed it,
      // so that slot is effectively gone for today.
      const busyForReschedule = [
        ...nonMissed,
        ...missed.map(m => ({ ...m, status: 'blocked' })),
      ];

      const missedAsTasks = missed.map(m => ({
        id: m.taskId, courseId: m.courseId,
        title: m.task, course: m.course,
        priority: m.priority || 'medium',
        estimatedHours: m.estimatedHours || 1,
        dueDate: null,
        completed: false,
      }));

      const planned = scheduleTasks(missedAsTasks, availDays, busyForReschedule, 4);

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

      setSchedule(() => {
        const updated = [
          ...src.map(s => missedIds.has(s.id) ? { ...s, status: 'missed' } : s),
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

  // FR7.1 / FR7.2: Mark one session as missed and immediately reschedule it
  const markAsMissed = async (session) => {
    const currentUid = uidRef.current;
    await updateSession(currentUid, session.courseId, session.taskId, session.id, { status: 'missed' });
    const updated = scheduleRef.current.map(s => s.id === session.id ? { ...s, status: 'missed' } : s);
    setSchedule(updated);
    scheduleRef.current = updated;
    await doRescheduleMissed(updated, [{ ...session, status: 'missed' }]);
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
      await generateFullPlan();
    } finally {
      setSavingAvail(false);
    }
  };

  // FR4.1: Toggle a 1-hour block in the availability grid
  const toggleSlot = (dayName, hour) => {
    setAvailability(prev => {
      const blockStart = minToStr(hour * 60);
      const blockEnd   = minToStr((hour + 1) * 60);

      return prev.map(d => {
        if (d.day !== dayName) return d;

        const slotIdx = d.slots.findIndex(s =>
          timeToMin(s.startTime) === hour * 60 &&
          timeToMin(s.endTime)   === (hour + 1) * 60
        );

        if (slotIdx !== -1) {
          return {
            ...d,
            slots: d.slots.map((s, si) =>
              si === slotIdx ? { ...s, available: !s.available } : s
            ),
          };
        }

        const containerIdx = d.slots.findIndex(s =>
          timeToMin(s.startTime) <= hour * 60 &&
          (hour + 1) * 60 <= timeToMin(s.endTime)
        );

        if (containerIdx !== -1) {
          return {
            ...d,
            slots: d.slots.map((s, si) =>
              si === containerIdx ? { ...s, available: !s.available } : s
            ),
          };
        }

        return {
          ...d,
          slots: [...d.slots, { startTime: blockStart, endTime: blockEnd, available: true }],
        };
      });
    });
  };

  // ── Confirm modal handlers ────────────────────────────────────
  const openConfirm  = (action, session) => setModalAction({ action, session });
  const closeConfirm = () => setModalAction(null);

  const handleConfirmAction = async () => {
    if (!modalAction) return;
    const { action, session } = modalAction;
    closeConfirm();

    if (action === 'complete') {
      const newStatus = session.status === 'completed' ? 'pending' : 'completed';
      await updateSession(uidRef.current, session.courseId, session.taskId, session.id, { status: newStatus });
      setSchedule(prev => prev.map(s => s.id === session.id ? { ...s, status: newStatus } : s));
    }

    if (action === 'missed') {
      await markAsMissed(session);
    }

    if (action === 'delete') {
      await deleteSession(uidRef.current, session.courseId, session.taskId, session.id);
      setSchedule(prev => prev.filter(s => s.id !== session.id));
    }
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


          <button className="add-session-button" style={{ background: '#f0f0f0', color: '#555' }}
            onClick={() => setShowAvailability(v => !v)}>
             {showAvailability ? 'Hide' : 'Edit'} Availability
          </button>

          <button className="add-session-button" onClick={() => generateFullPlan()} disabled={generating}
            style={{ background: 'linear-gradient(135deg, #e67a5f, #ee9b85)', opacity: generating ? 0.7 : 1 }}>
            {generating ? ' Generating...' : ' Generate Plan'}
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

      {/* FR4.1: Availability editor */}
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
                                    onClick={() => openConfirm('complete', session)}>✓</button>
                                  <button className="ss-action-btn ss-btn-missed" title="Mark as missed"
                                    onClick={() => openConfirm('missed', session)}>✕</button>
                                  <button className="ss-action-btn ss-btn-delete" title="Delete"
                                    onClick={() => openConfirm('delete', session)}>🗑</button>
                                </div>
                              )}
                              {isDone && (
                                <button className="ss-undo-btn"
                                  onClick={() => openConfirm('complete', session)}>
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

      {/* Confirm Modal — handles complete / missed / delete */}
      {modalAction && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {modalAction.action === 'delete' ? '🗑' : modalAction.action === 'missed' ? '✕' : '✓'}
            </div>
            <h2 className="modal-title">
              {modalAction.action === 'delete'
                ? 'Delete Session?'
                : modalAction.action === 'missed'
                ? 'Mark as Missed?'
                : modalAction.session?.status === 'completed'
                ? 'Undo Completion?'
                : 'Mark as Complete?'}
            </h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              {modalAction.action === 'delete'
                ? 'This will permanently delete this study session. This action cannot be undone.'
                : modalAction.action === 'missed'
                ? 'This session will be marked as missed and rescheduled automatically.'
                : 'Update the completion status of this study session.'}
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeConfirm}>Cancel</button>
              <button
                className="modal-save"
                onClick={handleConfirmAction}
                style={{
                  background: modalAction.action === 'delete'
                    ? 'linear-gradient(135deg, #f44336, #e57373)'
                    : modalAction.action === 'missed'
                    ? 'linear-gradient(135deg, #ff9800, #ffb74d)'
                    : 'linear-gradient(135deg, #4caf50, #81c784)',
                }}
              >
                {modalAction.action === 'delete'
                  ? '🗑 Delete'
                  : modalAction.action === 'missed'
                  ? '✕ Mark Missed'
                  : '✓ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}