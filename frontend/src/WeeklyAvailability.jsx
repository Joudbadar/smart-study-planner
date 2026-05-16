import React from "react";  
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./ScheduleAndTasks.css";
import "./WeeklyAvailability.css";

const defaultAvailability = [
  { day: "Sunday",    slots: [] },
  { day: "Monday",    slots: [] },
  { day: "Tuesday",   slots: [] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday",  slots: [] },
  { day: "Friday",    slots: [] },
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
  const [toast, setToast]                 = useState({ message: '', type: 'success' });
  const [uid, setUid]                     = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUid(user.uid);
      const ref      = doc(db, "users", user.uid, "settings", "weeklyAvailability");
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) return;

      const fixedData = (snapshot.data().availability || []).map((day) => ({
        day: day.day,
        slots: day.slots
          ? day.slots.map((s) => ({
              startTime: to24h(s.startTime),
              endTime:   to24h(s.endTime),
              available: true,
            }))
          : day.startTime || day.endTime
          ? [{ startTime: to24h(day.startTime || ""), endTime: to24h(day.endTime || ""), available: true }]
          : [],
      }));
      setAvailability(fixedData);
    });
    return () => unsubscribe();
  }, []);

  // Save to Firestore and show toast
  const saveToFirestore = async (newAvailability) => {
    if (!uid) return;
    try {
      const ref = doc(db, "users", uid, "settings", "weeklyAvailability");
      await setDoc(ref, { availability: newAvailability, updatedAt: new Date().toISOString() });
      showToast('✅ Availability saved!');
    } catch (err) {
      showToast('❌ Failed to save. Please try again.', 'error');
    }
  };

  const hasAvailableSlot = (day) => day.slots?.length > 0;

  const formatSlots = (day) => {
    if (!day.slots?.length) return "No time slots selected";
    return day.slots
      .map((s) => `${to12hDisplay(s.startTime)} – ${to12hDisplay(s.endTime)}`)
      .join("  |  ");
  };

  const addSlot = () => {
    const newAvailability = availability.map((day, i) =>
      i === selectedIndex
        ? { ...day, slots: [...(day.slots || []), { startTime: "", endTime: "", available: true }] }
        : day
    );
    setAvailability(newAvailability);
    // Don't auto-save yet — slot has no times yet
  };

  const updateSlot = (slotIndex, field, value) => {
    const newAvailability = availability.map((day, di) =>
      di === selectedIndex
        ? { ...day, slots: day.slots.map((s, si) => (si === slotIndex ? { ...s, [field]: value } : s)) }
        : day
    );
    setAvailability(newAvailability);

    // Validate time order on the fly and show toast if invalid
    const updatedSlot = newAvailability[selectedIndex].slots[slotIndex];
    if (updatedSlot.startTime && updatedSlot.endTime) {
      if (timeToMinutes(updatedSlot.startTime) >= timeToMinutes(updatedSlot.endTime)) {
        showToast('❌ End time must be after start time.', 'error');
      }
    }
  };

  const deleteSlot = (slotIndex) => {
    const newAvailability = availability.map((day, di) =>
      di === selectedIndex
        ? { ...day, slots: day.slots.filter((_, si) => si !== slotIndex) }
        : day
    );
    setAvailability(newAvailability);
  };

  const closeModal = () => {
    const day = availability[selectedIndex];
    for (const slot of day.slots || []) {
      if (!slot.startTime || !slot.endTime) {
        showToast(`❌ Please fill both start and end time for ${day.day}.`, 'error');
        return;
      }
      if (timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime)) {
        showToast(`❌ End time must be after start time in ${day.day}.`, 'error');
        return;
      }
    }
    saveToFirestore(availability);
    setSelectedIndex(null);
  };

  return (
    <div className="study-schedule-wrapper">

      <div className="schedule-header">
        <h1 className="schedule-title">Weekly Availability</h1>
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
              <p className="wa-empty-slot">No time slots yet. Add one below.</p>
            )}

            {(availability[selectedIndex].slots || []).map((slot, slotIndex) => (
              <div className="wa-slot-box" key={slotIndex}>
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

            <button className="wa-add-slot-btn" onClick={addSlot}>+ Add Time Slot</button>

            <div className="modal-actions">
              <button className="modal-save" onClick={closeModal} style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast.message && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#c0392b' : '#2d2d2d',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast.message}
        </div>
      )}

    </div>
  );
}

export default WeeklyAvailability;