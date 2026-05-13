import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./WeeklyAvailability.css";

const defaultAvailability = [
  {
    day: "Sunday",
    slots: [{ startTime: "10:00", endTime: "18:00", available: true }],
  },
  { day: "Monday", slots: [] },
  { day: "Tuesday", slots: [] },
  { day: "Wednesday", slots: [] },
  { day: "Thursday", slots: [] },
  {
    day: "Friday",
    slots: [{ startTime: "16:00", endTime: "21:00", available: true }],
  },
  { day: "Saturday", slots: [] },
];

function WeeklyAvailability() {
  const [availability, setAvailability] = useState(defaultAvailability);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const ref = doc(db, "users", user.uid, "settings", "weeklyAvailability");
      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {
        const savedData = snapshot.data().availability || [];

        const fixedData = savedData.map((day) => ({
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

  const hasAvailableSlot = (day) => {
    return day.slots?.some((slot) => slot.available) || false;
  };

  const formatSlots = (day) => {
    if (!day.slots || day.slots.length === 0) {
      return "No time slots selected";
    }

    return day.slots
      .map(
        (slot) =>
          `${slot.startTime || "--:--"} - ${slot.endTime || "--:--"} ${
            slot.available ? "(Available)" : "(Unavailable)"
          }`
      )
      .join(" | ");
  };

  const validateDaySlots = (day) => {
    for (const slot of day.slots || []) {
      if (!slot.startTime || !slot.endTime) {
        alert(`Please fill both start and end time in ${day.day}.`);
        return false;
      }

      if (slot.startTime >= slot.endTime) {
        alert(`End time must be after start time in ${day.day}.`);
        return false;
      }
    }

    return true;
  };

  const addSlot = () => {
    setAvailability((prev) =>
      prev.map((day, index) =>
        index === selectedIndex
          ? {
              ...day,
              slots: [
                ...(day.slots || []),
                { startTime: "", endTime: "", available: true },
              ],
            }
          : day
      )
    );
  };

  const updateSlot = (slotIndex, field, value) => {
    setAvailability((prev) =>
      prev.map((day, dayIndex) =>
        dayIndex === selectedIndex
          ? {
              ...day,
              slots: (day.slots || []).map((slot, index) =>
                index === slotIndex ? { ...slot, [field]: value } : slot
              ),
            }
          : day
      )
    );
  };

  const deleteSlot = (slotIndex) => {
    setAvailability((prev) =>
      prev.map((day, dayIndex) =>
        dayIndex === selectedIndex
          ? {
              ...day,
              slots: (day.slots || []).filter((_, index) => index !== slotIndex),
            }
          : day
      )
    );
  };

  const closeModalWithValidation = () => {
    const day = availability[selectedIndex];

    if (!validateDaySlots(day)) return;

    setSelectedIndex(null);
  };

  const saveAvailability = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please sign in first.");
      return;
    }

    for (const day of availability) {
      if (!validateDaySlots(day)) return;
    }

    const ref = doc(db, "users", user.uid, "settings", "weeklyAvailability");

    await setDoc(ref, {
      availability,
      updatedAt: new Date().toISOString(),
    });

    alert("Availability saved successfully!");
  };

  return (
    <div className="wa-page">
      <h1 className="wa-title">Weekly Availability</h1>
      <p className="wa-subtitle">
        Select and customize your weekly availability
      </p>

      <div className="wa-grid">
        {availability.map((day, index) => (
          <div
            key={day.day}
            className={`wa-card ${
              hasAvailableSlot(day) ? "wa-available" : "wa-unavailable"
            }`}
            onClick={() => setSelectedIndex(index)}
          >
            <h2 className="wa-day">{day.day}</h2>
            <p className="wa-time">{formatSlots(day)}</p>

            <span
              className={`wa-status ${
                hasAvailableSlot(day) ? "available-text" : "unavailable-text"
              }`}
            >
              {hasAvailableSlot(day) ? "Available" : "Unavailable"}
            </span>
          </div>
        ))}
      </div>

      <div className="wa-actions">
        <button className="wa-btn" onClick={saveAvailability}>
          Save Availability
        </button>
      </div>

      {selectedIndex !== null && (
        <div className="wa-modal-overlay">
          <div className="wa-modal">
            <h2>Edit {availability[selectedIndex].day}</h2>

            {(availability[selectedIndex].slots || []).length === 0 && (
              <p className="wa-empty-slot">No time slots yet.</p>
            )}

            {(availability[selectedIndex].slots || []).map((slot, slotIndex) => (
              <div className="wa-slot-box" key={slotIndex}>
                <div className="wa-check-group">
                  <label
                    className={`wa-check ${
                      slot.available ? "wa-active-check" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={slot.available}
                      onChange={() => updateSlot(slotIndex, "available", true)}
                    />
                    Available
                  </label>

                  <label
                    className={`wa-check ${
                      !slot.available ? "wa-active-uncheck" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!slot.available}
                      onChange={() => updateSlot(slotIndex, "available", false)}
                    />
                    Unavailable
                  </label>
                </div>

                <label className="wa-modal-label">Start Time</label>
                <input
                  className="wa-modal-input"
                  type="time"
                  value={slot.startTime}
                  onChange={(e) =>
                    updateSlot(slotIndex, "startTime", e.target.value)
                  }
                />

                <label className="wa-modal-label">End Time</label>
                <input
                  className="wa-modal-input"
                  type="time"
                  value={slot.endTime}
                  onChange={(e) =>
                    updateSlot(slotIndex, "endTime", e.target.value)
                  }
                />

                <button
                  className="wa-delete-slot-btn"
                  onClick={() => deleteSlot(slotIndex)}
                >
                  Delete Slot
                </button>
              </div>
            ))}

            <button className="wa-add-slot-btn" onClick={addSlot}>
              + Add Time Slot
            </button>

            <div className="wa-modal-actions">
              <button
                className="wa-cancel-btn"
                onClick={() => setSelectedIndex(null)}
              >
                Cancel
              </button>

              <button
                className="wa-save-btn"
                onClick={closeModalWithValidation}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeeklyAvailability;
