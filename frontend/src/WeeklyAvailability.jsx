import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./ScheduleAndTasks.css";
import "./WeeklyAvailability.css";
import React from 'react';

const defaultAvailability = [
  { day: "Sunday",    slots: [{ startTime: "10:00", endTime: "18:00", available: true }] },
  { day: "Monday",    slots: [] },
  { day: "Tuesday",   slots: [] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday",  slots: [] },
  { day: "Friday",    slots: [{ startTime: "16:00", endTime: "21:00", available: true }] },
  { day: "Saturday",  slots: [] },
];

function to24h(val) {
  if (!val) return "";
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  const [hm, ap] = val.split(" ");
  if (!ap) return val;
  let [h, m] = hm.split(":").map(Number);
  if (ap === "AM") { if (h === 12) h = 0; }
  else             { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(val) {
  if (!val) return 0;
  const [h, m] = val.split(":").map(Number);
  return h * 60 + m;
}

function to12hDisplay(val) {
  if (!val) return "--:--";
  const [h, m] = val.split(":").map(Number);
  const ap   = h >= 12 ? "PM" : "AM";
  const disp = h % 12 || 12;
  return `${String(disp).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
}

function WeeklyAvailability() {
  const [availability, setAvailability]   = useState(defaultAvailability);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [toast, setToast]                 = useState('');

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

  const hasAvailableSlot = (day) => (day.slots?.length || 0) > 0;

  console.log("availability",availability);
  

  const formatSlots = (day) => {
    if (!day.slots?.length) return "No time slots selected";
    return day.slots
      .map((s) => `${to12hDisplay(s.startTime)} – ${to12hDisplay(s.endTime)}${timeToMinutes(s.endTime) <= timeToMinutes(s.startTime) ? " (next day)" : ""}`)
      .join("  |  ");
  };

  const validateDaySlots = (day) => {
    for (const slot of day.slots || []) {
      if (!slot.startTime || !slot.endTime) {
        alert(`Please fill both start and end time in ${day.day}.`);
        return false;
      }
      if (slot.startTime === slot.endTime) {
        alert(`Start and end time cannot be the same in ${day.day}.`);
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
    setToast('✅ Availability saved successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">Weekly Availability</h1>
        <button className="add-session-button" onClick={saveAvailability}>
          Save Availability
        </button>
      </div>

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
                <div className="modal-row">
                  <div className="modal-col">
                    <label className="modal-label">Start Time <span className="modal-required">*</span></label>
                    <input className="modal-input" type="time" value={slot.startTime} onChange={(e) => updateSlot(slotIndex, "startTime", e.target.value)} />
                  </div>
                  <div className="modal-col">
                    <label className="modal-label">End Time <span className="modal-required">*</span></label>
                    <input className="modal-input" type="time" value={slot.endTime} onChange={(e) => updateSlot(slotIndex, "endTime", e.target.value)} />
                  </div>
                </div>

                <button className="wa-delete-slot-btn" onClick={() => deleteSlot(slotIndex)}>
                  Delete Slot
                </button>
              </div>
            ))}

            <button className="wa-add-slot-btn" onClick={addSlot}>+ Add Time Slot</button>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSelectedIndex(null)}>Cancel</button>
              <button className="modal-save"   onClick={closeModalWithValidation}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#2d2d2d',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'fadeSlideIn 0.3s ease',
        }}>
          {toast}
        </div>
      )}

    </div>
  );
}

export default WeeklyAvailability;