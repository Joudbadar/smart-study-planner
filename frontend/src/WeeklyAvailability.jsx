import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./ScheduleAndTasks.css";
import "./WeeklyAvailability.css";

const defaultAvailability = [
  { day: "Sunday",    slots: [{ startTime: "10:00", endTime: "18:00", available: true }] },
  { day: "Monday",    slots: [] },
  { day: "Tuesday",   slots: [] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday",  slots: [] },
  { day: "Friday",    slots: [{ startTime: "16:00", endTime: "21:00", available: true }] },
  { day: "Saturday",  slots: [] },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Normalise any stored time value to "HH:MM" (24-h) */
function to24h(val) {
  if (!val) return "";
  // Already "HH:MM"
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  // "HH:MM AM/PM"
  const [hm, ap] = val.split(" ");
  if (!ap) return val;
  let [h, m] = hm.split(":").map(Number);
  if (ap === "AM") { if (h === 12) h = 0; }
  else             { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutes since midnight for comparison */
function timeToMinutes(val) {
  if (!val) return 0;
  const [h, m] = val.split(":").map(Number);
  return h * 60 + m;
}

/** Display helper: "HH:MM" → "HH:MM AM/PM" */
function to12hDisplay(val) {
  if (!val) return "--:--";
  const [h, m] = val.split(":").map(Number);
  const ap   = h >= 12 ? "PM" : "AM";
  const disp = h % 12 || 12;
  return `${String(disp).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function WeeklyAvailability() {
  const [availability, setAvailability]   = useState(defaultAvailability);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const ref      = doc(db, "users", user.uid, "settings", "weeklyAvailability");
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) return;

      const fixedData = (snapshot.data().availability || []).map((day) => ({
        day: day.day,
        slots: day.slots
          ? day.slots.map((s) => ({ ...s, startTime: to24h(s.startTime), endTime: to24h(s.endTime) }))
          : day.startTime || day.endTime
          ? [{ startTime: to24h(day.startTime || ""), endTime: to24h(day.endTime || ""), available: day.available ?? false }]
          : [],
      }));
      setAvailability(fixedData);
    });
    return () => unsubscribe();
  }, []);

  const hasAvailableSlot = (day) => day.slots?.some((s) => s.available) || false;

  const formatSlots = (day) => {
    if (!day.slots?.length) return "No time slots selected";
    return day.slots
      .map((s) => `${to12hDisplay(s.startTime)} – ${to12hDisplay(s.endTime)} ${s.available ? "(Available)" : "(Unavailable)"}`)
      .join("  |  ");
  };

  const validateDaySlots = (day) => {
    for (const slot of day.slots || []) {
      if (!slot.startTime || !slot.endTime) {
        alert(`Please fill both start and end time in ${day.day}.`);
        return false;
      }
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        alert(`End time must be after start time in ${day.day}.`);
        return false;
      }
    }
    return true;
  };

  const addSlot = () =>
    setAvailability((prev) =>
      prev.map((day, i) =>
        i === selectedIndex
          ? { ...day, slots: [...(day.slots || []), { startTime: "", endTime: "", available: true }] }
          : day
      )
    );

  const updateSlot = (slotIndex, field, value) =>
    setAvailability((prev) =>
      prev.map((day, di) =>
        di === selectedIndex
          ? { ...day, slots: day.slots.map((s, si) => (si === slotIndex ? { ...s, [field]: value } : s)) }
          : day
      )
    );

  const deleteSlot = (slotIndex) =>
    setAvailability((prev) =>
      prev.map((day, di) =>
        di === selectedIndex
          ? { ...day, slots: day.slots.filter((_, si) => si !== slotIndex) }
          : day
      )
    );

  const closeModalWithValidation = () => {
    if (!validateDaySlots(availability[selectedIndex])) return;
    setSelectedIndex(null);
  };

  const saveAvailability = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Please sign in first.");
    for (const day of availability) {
      if (!validateDaySlots(day)) return;
    }
    const ref = doc(db, "users", user.uid, "settings", "weeklyAvailability");
    await setDoc(ref, { availability, updatedAt: new Date().toISOString() });
    alert("Availability saved successfully!");
  };

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">Weekly Availability</h1>
        <button className="add-session-button" onClick={saveAvailability}>
          Save Availability
        </button>
      </div>

      {/* Day cards grid */}
      <div className="wa-grid">
        {availability.map((day, index) => (
          <div
            key={day.day}
            className={`wa-card ${hasAvailableSlot(day) ? "wa-available" : "wa-unavailable"}`}
            onClick={() => setSelectedIndex(index)}
          >
            <h2 className="wa-day">{day.day}</h2>
            <p className="wa-time">{formatSlots(day)}</p>
            <span className={`wa-status ${hasAvailableSlot(day) ? "available-text" : "unavailable-text"}`}>
              {hasAvailableSlot(day) ? "Available" : "Unavailable"}
            </span>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {selectedIndex !== null && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Edit {availability[selectedIndex].day}</h2>

            {!(availability[selectedIndex].slots?.length) && (
              <p className="wa-empty-slot">No time slots yet.</p>
            )}

            {(availability[selectedIndex].slots || []).map((slot, slotIndex) => (
              <div className="wa-slot-box" key={slotIndex}>

                {/* Available / Unavailable toggle */}
                <div className="wa-check-group">
                  <label className={`wa-check ${slot.available ? "wa-active-check" : ""}`}>
                    <input type="checkbox" checked={slot.available} onChange={() => updateSlot(slotIndex, "available", true)} />
                    Available
                  </label>
                  <label className={`wa-check ${!slot.available ? "wa-active-uncheck" : ""}`}>
                    <input type="checkbox" checked={!slot.available} onChange={() => updateSlot(slotIndex, "available", false)} />
                    Unavailable
                  </label>
                </div>

                {/* Time inputs — same as StudySchedule */}
                <div className="modal-row">
                  <div className="modal-col">
                    <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                    <input
                      className="modal-input"
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlot(slotIndex, "startTime", e.target.value)}
                    />
                  </div>
                  <div className="modal-col">
                    <label className="modal-label">End Time <span className="modal-required">*</span></label>
                    <input
                      className="modal-input"
                      type="time"
                      value={slot.endTime}
                      min={slot.startTime || undefined}
                      onChange={(e) => updateSlot(slotIndex, "endTime", e.target.value)}
                    />
                  </div>
                </div>

                <button className="wa-delete-slot-btn" onClick={() => deleteSlot(slotIndex)}>
                  Delete Slot
                </button>
              </div>
            ))}

            <button className="wa-add-slot-btn" onClick={addSlot}>
              + Add Time Slot
            </button>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSelectedIndex(null)}>Cancel</button>
              <button className="modal-save"   onClick={closeModalWithValidation}>Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default WeeklyAvailability;