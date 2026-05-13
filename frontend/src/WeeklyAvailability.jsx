import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import "./WeeklyAvailability.css";

const defaultAvailability = [
  { day: "Sunday", startTime: "10:00", endTime: "18:00", available: true },
  { day: "Monday", startTime: "", endTime: "", available: false },
  { day: "Tuesday", startTime: "", endTime: "", available: false },
  { day: "Wednesday", startTime: "", endTime: "", available: false },
  { day: "Thursday", startTime: "", endTime: "", available: false },
  { day: "Friday", startTime: "16:00", endTime: "21:00", available: true },
  { day: "Saturday", startTime: "", endTime: "", available: false },
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
        setAvailability(snapshot.data().availability);
      }
    });

    return () => unsubscribe();
  }, []);

  const formatTime = (item) => {
    if (item.startTime && item.endTime) {
      return `${item.startTime} - ${item.endTime}`;
    }

    if (!item.available) return "Not Available";

    return "Time not selected";
  };

  const updateSelectedDay = (field, value) => {
    setAvailability((prev) =>
      prev.map((item, index) =>
        index === selectedIndex ? { ...item, [field]: value } : item
      )
    );
  };

  const saveAvailability = async () => {
    const user = auth.currentUser;

    if (!user) {
      alert("Please sign in first.");
      return;
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
        {availability.map((item, index) => (
          <div
            key={item.day}
            className={`wa-card ${
              item.available ? "wa-available" : "wa-unavailable"
            }`}
            onClick={() => setSelectedIndex(index)}
          >
            <h2 className="wa-day">{item.day}</h2>
            <p className="wa-time">{formatTime(item)}</p>

            <span
              className={`wa-status ${
                item.available ? "available-text" : "unavailable-text"
              }`}
            >
              {item.available ? "Available" : "Unavailable"}
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

            <div className="wa-check-group">
              <label
                className={`wa-check ${
                  availability[selectedIndex].available
                    ? "wa-active-check"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={availability[selectedIndex].available}
                  onChange={() => updateSelectedDay("available", true)}
                />
                Available
              </label>

              <label
                className={`wa-check ${
                  !availability[selectedIndex].available
                    ? "wa-active-uncheck"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={!availability[selectedIndex].available}
                  onChange={() => updateSelectedDay("available", false)}
                />
                Unavailable
              </label>
            </div>

            <label className="wa-modal-label">Start Time</label>
            <input
              className="wa-modal-input"
              type="time"
              value={availability[selectedIndex].startTime}
              onChange={(e) => updateSelectedDay("startTime", e.target.value)}
            />

            <label className="wa-modal-label">End Time</label>
            <input
              className="wa-modal-input"
              type="time"
              value={availability[selectedIndex].endTime}
              onChange={(e) => updateSelectedDay("endTime", e.target.value)}
            />

            <div className="wa-modal-actions">
              <button
                className="wa-cancel-btn"
                onClick={() => setSelectedIndex(null)}
              >
                Cancel
              </button>

              <button
                className="wa-save-btn"
                onClick={() => setSelectedIndex(null)}
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
