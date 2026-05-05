import { useState } from 'react';
import './StudyPlan.css';

export default function StudyPlan() {
  const [plan, setPlan] = useState([]);

  const handleGenerate = () => {
    const saved = JSON.parse(localStorage.getItem('weeklyAvailability'));

    if (!saved) {
      alert('Please set your availability first!');
      return;
    }

    const availableDays = saved.filter((day) => day.available);

    if (availableDays.length === 0) {
      alert('No available days selected!');
      return;
    }

    const times = [
      '10:00 AM - 12:00 PM',
      '1:00 PM - 3:00 PM',
      '3:00 PM - 5:00 PM',
      '5:00 PM - 7:00 PM'
    ];

    const courses = ['SWE 381', 'CSC 212', 'MATH 251', 'CSC 371'];

    const tasks = [
      'Review lecture notes',
      'Solve practice problems',
      'Prepare for quiz',
      'Work on assignment'
    ];

    const generatedPlan = availableDays.map((day, index) => ({
      day: day.day,
      time: times[index % times.length],
      course: courses[index % courses.length],
      task: tasks[index % tasks.length]
    }));

    setPlan(generatedPlan);
  };

  return (
    <div className="sp-page">
      <button className="sp-generate-btn" onClick={handleGenerate}>
        Generate My Study Plan
      </button>

      {plan.length > 0 && (
        <div className="sp-card">
          <h2 className="sp-heading">Generated Plan</h2>
          <p className="sp-note">Based on your weekly availability</p>

          <div className="sp-list">
            {plan.map((item, index) => (
              <div className="sp-session" key={index}>
                <h3 className="sp-session-day">
                  {item.day} • {item.time}
                </h3>
                <p className="sp-session-course">{item.course}</p>
                <p className="sp-session-task">{item.task}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
