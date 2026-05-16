import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { fetchAllTasks } from './services/TaskService';
import { fetchAllSessions } from './services/SessionService';
import { Bell } from 'lucide-react'; 
import './NotificationBell.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [uid, setUid] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;

    const checkDeadlinesAndSessions = async () => {
      try {
        const [allTasks, allSessions] = await Promise.all([
          fetchAllTasks(uid),
          fetchAllSessions(uid)
        ]);

        const now = new Date();
        
        // Get today's date in YYYY-MM-DD format based on local time
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const generatedAlerts = [];

        // 1. Check Tasks
        allTasks.forEach(task => {
          if (task.completed) return;

          // If the task is due today
          if (task.dueDate === todayStr) {
            generatedAlerts.push({
              id: `task-${task.id}`,
              title: '⚠️ Urgent: Due Today!',
              message: `The task "${task.title}" for [${task.course}] is due today.`,
              type: 'task',
              time: 'Today'
            });
          } 
          // If the task is due within less than 24 hours
          else {
            const dueDate = new Date(`${task.dueDate}T23:59:59`);
            const diffMs = dueDate - now;
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 0 && diffHours <= 24) {
              generatedAlerts.push({
                id: `task-${task.id}`,
                title: '⏰ Approaching Deadline',
                message: `The task "${task.title}" for [${task.course}] is due in less than 24 hours.`,
                type: 'task',
                time: 'Urgent'
              });
            }
          }
        });

        // 2. Check Study Sessions
        allSessions.forEach(session => {
          if (session.status === 'completed' || session.status === 'missed' || session.date !== todayStr) return;

          if (session.time && session.time.includes(' - ')) {
            const [startTimeStr] = session.time.split(' - ');
            const sessionTime = new Date(`${session.date}T${startTimeStr}:00`);
            const diffMs = sessionTime - now;
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMinutes > 0 && diffMinutes <= 30) {
              generatedAlerts.push({
                id: `session-${session.id}`,
                title: '📚 Study Session Reminder',
                message: `Your session "${session.task}" for [${session.course}] starts in less than 30 minutes.`,
                type: 'session',
                time: 'Soon'
              });
            }
          }
        });

        setNotifications(generatedAlerts);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    checkDeadlinesAndSessions();
    const interval = setInterval(checkDeadlinesAndSessions, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [uid]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.length;

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button className="bell-button" onClick={() => setShowDropdown(!showDropdown)}>
       
        <Bell size={20} className="lucide-bell-icon" />
        
        {unreadCount > 0 && (
          <span className="bell-badge animate-pulse">{unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <div className="bell-dropdown">
          <div className="dropdown-header">
            <h3>Notifications & Reminders</h3>
            {unreadCount > 0 && <span className="unread-tag">{unreadCount} New</span>}
          </div>

          <div className="dropdown-body">
            {notifications.length === 0 ? (
              <div className="empty-notifications">
             
                <p>Your schedule looks great! No urgent reminders.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className={`notification-item ${notif.type}`}>
                  <div className="item-header">
                    <strong className="item-title">{notif.title}</strong>
                    <span className="item-time">{notif.time}</span>
                  </div>
                  <p className="item-message">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}