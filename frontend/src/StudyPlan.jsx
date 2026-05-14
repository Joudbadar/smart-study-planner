import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import { fetchAllTasks } from "./services/TaskService";
import { fetchCourses } from "./services/CourseService";
import "./StudyPlan.css";

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function StudyPlan() {
  const [availability, setAvailability] = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [courses, setCourses]           = useState([]);
  const [studyPlan, setStudyPlan]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [uid, setUid]                   = useState(null);
  const [generating, setGenerating]     = useState(false);

  // ── Load data on auth ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      setUid(user.uid);

      // 1. Load availability
      const availRef  = doc(db, "users", user.uid, "settings", "weeklyAvailability");
      const availSnap = await getDoc(availRef);
      if (availSnap.exists()) {
        const data = availSnap.data().availability || [];
        setAvailability(data.map(day => ({
          day: day.day,
          slots: day.slots || [],
        })));
      }

      // 2. Load tasks
      const allTasks = await fetchAllTasks(user.uid);
      setTasks(allTasks);

      // 3. Load courses
      const allCourses = await fetchCourses(user.uid);
      setCourses(allCourses);

      // 4. Load saved plan
      const planRef  = doc(db, "users", user.uid, "settings", "studyPlan");
      const planSnap = await getDoc(planRef);
      if (planSnap.exists()) {
        setStudyPlan(planSnap.data().plan || []);
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Helper: add hours to time string ──
  const addHours = (time, hours) => {
    const [h, m] = time.split(":").map(Number);
    const total  = h * 60 + m + Math.round(Number(hours) * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  // ── Generate plan automatically ──
  const generatePlan = async () => {
    if (!uid) return;
    setGenerating(true);

    const availableDays = availability.filter(d => d.slots?.some(s => s.available));

    if (availableDays.length === 0) {
      alert("Please set your weekly availability first!");
      setGenerating(false);
      return;
    }

    if (tasks.length === 0) {
      alert("Please add some tasks/deadlines first!");
      setGenerating(false);
      return;
    }

    // Sort tasks by due date (soonest first = highest priority)
    const sortedTasks = [...tasks]
      .filter(t => !t.completed)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const generatedPlan = [];
    let dayIndex = 0;

    for (const task of sortedTasks) {
      // Find the next available day with a free slot
      let assigned = false;
      let attempts = 0;

      while (!assigned && attempts < availableDays.length) {
        const day = availableDays[dayIndex % availableDays.length];
        const slot = day.slots.find(s => s.available);

        if (slot) {
          // Check if this slot is already used
          const alreadyUsed = generatedPlan.find(
            p => p.day === day.day && p.startTime === slot.startTime
          );

          if (!alreadyUsed) {
            const endTime = addHours(slot.startTime, 1); // default 1 hour per task

            // Make sure end time doesn't exceed slot end
            if (endTime <= slot.endTime) {
              generatedPlan.push({
                id: Date.now() + Math.random(),
                day: day.day,
                startTime: slot.startTime,
                endTime,
                task: task.title,
                course: task.course,
                dueDate: task.dueDate,
                priority: task.priority || 'medium',
              });
              assigned = true;
            }
          }
        }

        dayIndex++;
        attempts++;
      }
    }

    // Save to Firestore
    const planRef = doc(db, "users", uid, "settings", "studyPlan");
    await setDoc(planRef, {
      plan: generatedPlan,
      generatedAt: new Date().toISOString(),
    });

    setStudyPlan(generatedPlan);
    setGenerating(false);
  };

  const clearPlan = async () => {
    if (!uid) return;
    const planRef = doc(db, "users", uid, "settings", "studyPlan");
    await setDoc(planRef, { plan: [], generatedAt: new Date().toISOString() });
    setStudyPlan([]);
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>;

  const pendingTasks  = tasks.filter(t => !t.completed);
  const availableDays = availability.filter(d => d.slots?.some(s => s.available));

  return (
    <div className="sp-page">

      {/* Info Cards */}
      <div className="sp-info-grid">
        <div className="sp-info-card">
          <div className="sp-info-number">{availableDays.length}</div>
          <div className="sp-info-label">Available Days</div>
        </div>
        <div className="sp-info-card">
          <div className="sp-info-number">{pendingTasks.length}</div>
          <div className="sp-info-label">Pending Tasks</div>
        </div>
        <div className="sp-info-card">
          <div className="sp-info-number">{courses.length}</div>
          <div className="sp-info-label">Courses</div>
        </div>
        <div className="sp-info-card">
          <div className="sp-info-number">{studyPlan.length}</div>
          <div className="sp-info-label">Scheduled Sessions</div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="sp-form-card">
        <h1 className="sp-heading">📅 Generate Study Plan</h1>
        <p className="sp-note">
          The system will automatically generate a weekly study plan based on your
          pending tasks, deadlines, and weekly availability.
        </p>

        {pendingTasks.length === 0 && (
          <p style={{ color: '#e67a5f', marginBottom: '12px' }}>
            ⚠️ No pending tasks found. Please add tasks in Tasks & Deadlines first.
          </p>
        )}

        {availableDays.length === 0 && (
          <p style={{ color: '#e67a5f', marginBottom: '12px' }}>
            ⚠️ No availability set. Please update your Weekly Availability first.
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="sp-generate-btn"
            onClick={generatePlan}
            disabled={generating || pendingTasks.length === 0 || availableDays.length === 0}
          >
            {generating ? '⏳ Generating...' : ' Generate My Study Plan'}
          </button>

          {studyPlan.length > 0 && (
            <button
              className="sp-generate-btn"
              onClick={clearPlan}
              style={{ background: '#f0f0f0', color: '#666' }}
            >
              🗑 Clear Plan
            </button>
          )}
        </div>
      </div>

      {/* Generated Plan */}
      <div className="sp-card">
        <h1 className="sp-heading">Weekly Study Plan</h1>
        <p className="sp-note">
          {studyPlan.length > 0
            ? 'Your personalized study plan based on your tasks and availability.'
            : 'Click "Generate My Study Plan" to create your schedule.'}
        </p>

        <div className="sp-list">
          {studyPlan.length === 0 ? (
            <p className="sp-empty">No study plan generated yet.</p>
          ) : (
            WEEK_DAYS.map((day) => {
              const dayPlans = studyPlan.filter(p => p.day === day);
              if (dayPlans.length === 0) return null;
              return (
                <div className="sp-day-section" key={day}>
                  <h2 className="sp-day-title">{day}</h2>
                  {dayPlans.map((plan) => (
                    <div className="sp-session" key={plan.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className="sp-session-day">
                          🕐 {plan.startTime} – {plan.endTime}
                        </p>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: plan.priority === 'high' ? '#ffebee' : plan.priority === 'low' ? '#e8f5e9' : '#fff3e0',
                          color: plan.priority === 'high' ? '#f44336' : plan.priority === 'low' ? '#4caf50' : '#ff9800',
                          fontWeight: '600',
                        }}>
                          {plan.priority}
                        </span>
                      </div>
                      <p className="sp-session-course">📚 {plan.course}</p>
                      <p className="sp-session-task">📝 {plan.task}</p>
                      {plan.dueDate && (
                        <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                          📅 Due: {plan.dueDate}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default StudyPlan;