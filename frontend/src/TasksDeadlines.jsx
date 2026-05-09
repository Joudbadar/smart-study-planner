import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { fetchTasks, updateTask, deleteTask } from './services/TaskService';
import './TasksDeadlines.css';

/*
const deadlines = [
  { id: 1, title: 'Demo Submission', course: 'SWE 381', dueDate: 'Apr 10', priority: 'high', completed: false },
  { id: 2, title: 'Phase One Submission', course: 'SWE 333', dueDate: 'Apr 12', priority: 'low', completed: false },
  { id: 4, title: 'Tutorial 2', course: 'SWE 321', dueDate: 'Apr 18', priority: 'medium', completed: true },
  { id: 5, title: 'Final Project Proposal', course: 'SWE 381', dueDate: 'Apr 20', priority: 'high', completed: false },
];
*/




export default function TasksDeadlines() {

// ----------- new -----------
//  Removed static deadlines array, implemented dynamic state
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = getAuth().currentUser?.uid;

  // fetch data on mount
  useEffect(() => {
    if (!uid) return;
    fetchTasks(uid).then(data => {
      setDeadlines(data);
      setLoading(false);
    });
  }, [uid]);

  // action handlers hooked to Firebase
  const handleComplete = async (id, currentStatus) => {
    await updateTask(uid, id, { completed: !currentStatus });
    setDeadlines(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(uid, id);
    setDeadlines(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <p>Loading tasks...</p>;


  return (
    <div className="tasks-deadlines-wrapper">
      {/* Header Section */}
      <div className="tasks-header">
        <h1 className="tasks-title">⚠️ Tasks & Deadlines</h1>
        <button className="add-task-button">+ Add Task</button>
      </div>

      {/* Statistics Section */}
      <div className="statistics-cards-container">
        <div className="statistic-card-item">
          <div className="statistic-number">{deadlines.length}</div>
          <div className="statistic-label-text">Total Tasks</div>
        </div>
        <div className="statistic-card-item">
          <div className="statistic-number">{deadlines.filter(d => d.priority === 'high').length}</div>
          <div className="statistic-label-text">High Priority</div>
        </div>
        <div className="statistic-card-item">
          <div className="statistic-number">{deadlines.filter(d => d.completed).length}</div>
          <div className="statistic-label-text">Completed</div>
        </div>
      </div>

      {/* Filter Buttons Section */}
      <div className="filter-buttons-container">
        <button className="filter-button active">All</button>
        <button className="filter-button">High</button>
        <button className="filter-button">Medium</button>
        <button className="filter-button">Low</button>
      </div>

      {/* Deadlines List Section */}
      <div className="deadlines-list-container">
        {deadlines.map(item => (
          <div 
            key={item.id} 
            className={`deadline-task-card ${item.priority} ${item.completed ? 'task-completed' : ''}`}
          >
            {/* Priority Badge */}
            <div className={`priority-badge ${item.priority}`}>{item.priority}</div>
            
            {/* Task Information */}
            <div className="task-info-section">
              <div className="task-title">{item.title}</div>
              <div className="task-course-name">{item.course}</div>
              <div className="task-due-date">📅 Due: {item.dueDate}</div>
            </div>
            
            {/* Action Buttons */}
            <div className="task-action-buttons">
              {/*
              <button className="complete-task-button">✓</button>
              <button className="edit-task-button">✎</button>
              <button className="delete-task-button">🗑</button>
              */}

              <button className="complete-task-button" onClick={() => handleComplete(item.id, item.completed)}>✓</button>
              <button className="edit-task-button">✎</button>
              <button className="delete-task-button" onClick={() => handleDelete(item.id)}>🗑</button>
            
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}