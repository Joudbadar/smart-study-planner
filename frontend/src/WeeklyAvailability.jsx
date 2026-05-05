import { useState, useEffect } from 'react';
import './WeeklyAvailability.css';

const defaultWeeklyData = [
  { day: 'Sunday', time: '10 AM - 6 PM', available: true },
  { day: 'Monday', time: '2 PM - 9 PM', available: true },
  { day: 'Tuesday', time: '3 PM - 8 PM', available: true },
  { day: 'Wednesday', time: '1 PM - 7 PM', available: true },
  { day: 'Thursday', time: 'Not Available', available: false },
  { day: 'Friday', time: '4 PM - 9 PM', available: true },
  { day: 'Saturday', time: 'Not Available', available: false },
];

export default function WeeklyAvailability() {
  const [weeklyData, setWeeklyData] = useState(defaultWeeklyData);

  // تحميل البيانات إذا كانت محفوظة
  useEffect(() => {
    const savedAvailability = localStorage.getItem('weeklyAvailability');
    if (savedAvailability) {
      setWeeklyData(JSON.parse(savedAvailability));
    }
  }, []);

  // تغيير الحالة عند الضغط
  const toggleAvailability = (index) => {
    const updatedData = [...weeklyData];
    const currentDay = updatedData[index];

    if (currentDay.available) {
      updatedData[index] = {
        ...currentDay,
        available: false,
        time: 'Not Available',
      };
    } else {
      updatedData[index] = {
        ...currentDay,
        available: true,
        time: '2 PM - 6 PM',
      };
    }

    setWeeklyData(updatedData);
  };

  // حفظ البيانات
  const handleSave = () => {
    localStorage.setItem('weeklyAvailability', JSON.stringify(weeklyData));
    alert('Availability saved successfully!');
  };

  return (
    <div className="wa-page">
      <h1 className="wa-title">Weekly Availability</h1>

      <p className="wa-subtitle">
        Click on a day to mark it as available or unavailable
      </p>

      <div className="wa-grid">
        {weeklyData.map((item, index) => (
          <div
            key={item.day}
            className={`wa-card ${item.available ? 'wa-available' : 'wa-unavailable'}`}
            onClick={() => toggleAvailability(index)}
          >
            <h3 className="wa-day">{item.day}</h3>

            <p className="wa-time">{item.time}</p>

            <span
              className={`wa-status ${item.available ? 'available-text' : 'unavailable-text'}`}
            >
              {item.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>

      <div className="wa-actions">
        <button className="wa-btn" onClick={handleSave}>
          Save Availability
        </button>
      </div>
    </div>
  );
}
