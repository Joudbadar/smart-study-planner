import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./StudyPlan.css";

const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function StudyPlan() {
  const [availability, setAvailability] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [taskName, setTaskName] = useState("");
  const [duration, setDuration] = useState("1");
  const [studyPlan, setStudyPlan] = useState([]);

  useEffect(() => {
    const savedPlans = JSON.parse(localStorage.getItem("studyPlans")) || [];
    setStudyPlan(savedPlans);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const ref = doc(db, "users", user.uid, "settings", "weeklyAvailability");
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        const data = snapshot.data().availability || [];

        const fixedData = data.map((day) => ({
          day: day.day,
          slots: day.slots
            ? day.slots
            : day.startTime || day.endTime
            ? [
                {
                  startTime: day.startTime || "",
                  endTime: day.endTime || "",
                  available: day.available ?? false,
                },
              ]
            : [],
        }));

        setAvailability(fixedData);
      }
    });

    return () => unsubscribe();
  }, []);

  const availableDays = availability.filter((day) =>
    day.slots?.some((slot) => slot.available)
  );

  const addHours = (time, hours) => {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m + Number(hours) * 60;

    const newHours = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, "0");

    const newMinutes = Math.floor(totalMinutes % 60)
      .toString()
      .padStart(2, "0");

    return `${newHours}:${newMinutes}`;
  };

  const generatePlan = () => {
    if (!selectedDay || !taskName || !duration) {
      alert("Please select a day, enter a task, and choose duration.");
      return;
    }

    const day = availability.find((item) => item.day === selectedDay);
    const availableSlot = day?.slots?.find((slot) => slot.available);

    if (!availableSlot) {
      alert("No available time slot for this day.");
      return;
    }

    const startTime = availableSlot.startTime;
    const endTime = addHours(startTime, duration);

    if (endTime > availableSlot.endTime) {
      alert("The task duration is longer than the available time slot.");
      return;
    }

    const newPlan = {
      id: Date.now(),
      day: selectedDay,
      task: taskName,
      startTime,
      endTime,
      duration,
    };

    const updatedPlans = [...studyPlan, newPlan];

    setStudyPlan(updatedPlans);
    localStorage.setItem("studyPlans", JSON.stringify(updatedPlans));

    setTaskName("");
    setDuration("1");
  };

  return (
    <div className="sp-page">
      <div className="sp-form-card">
        <h1 className="sp-heading">Generate Study Plan</h1>
        <p className="sp-note">
          Based on your weekly availability, select a day and add a study task.
        </p>

        <div className="sp-form-grid">
          <div className="sp-form-group">
            <label>Select Day</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              <option value="">Choose a day</option>
              {availableDays.map((day) => (
                <option key={day.day} value={day.day}>
                  {day.day}
                </option>
              ))}
            </select>
          </div>

          <div className="sp-form-group">
            <label>Task / Course Name</label>
            <input
              type="text"
              placeholder="Example: Database Assignment"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
          </div>

          <div className="sp-form-group">
            <label>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="0.25">15 minutes</option>
              <option value="0.5">30 minutes</option>
              <option value="1">1 hour</option>
              <option value="1.5">1.5 hours</option>
              <option value="2">2 hours</option>
              <option value="2.5">2.5 hours</option>
              <option value="3">3 hours</option>
              <option value="4">4 hours</option>
              <option value="5">5 hours</option>
            </select>
          </div>
        </div>

        <button className="sp-generate-btn" onClick={generatePlan}>
          Generate Plan
        </button>
      </div>

      <div className="sp-card">
        <h1 className="sp-heading">Weekly Study Plan</h1>
        <p className="sp-note">Your generated plans will appear here.</p>

        <div className="sp-list">
          {studyPlan.length === 0 ? (
            <p className="sp-empty">No study plan generated yet.</p>
          ) : (
            weekDays.map((day) => {
              const dayPlans = studyPlan.filter((plan) => plan.day === day);

              if (dayPlans.length === 0) return null;

              return (
                <div className="sp-day-section" key={day}>
                  <h2 className="sp-day-title">{day}</h2>

                  {dayPlans.map((plan) => (
                    <div className="sp-session" key={plan.id}>
                      <p className="sp-session-day">
                        {plan.startTime} to {plan.endTime}
                      </p>

                      <p className="sp-session-course">{plan.task}</p>

                      <p className="sp-session-task">
                        Duration: {Number(plan.duration) * 60} minutes
                      </p>
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
