import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { fetchTasks, addTask, updateTask, deleteTask } from './services/TaskService';
import './ScheduleAndTasks.css';

const EMPTY_FORM = { title: '', course: '', dueDate: '', dueDay: '', dueMonth: '', dueYear: '2026', priority: 'medium' };

export default function TasksDeadlines() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const uid = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    fetchTasks(uid).then(data => {
      setDeadlines(data);
      setLoading(false);
    });
  }, [uid]);

  const handleComplete = async (id, currentStatus) => {
    await updateTask(uid, id, { completed: !currentStatus });
    setDeadlines(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(uid, id);
    setDeadlines(prev => prev.filter(t => t.id !== id));
  };

  const handleAdd = async () => {
    if (!form.title)    return alert('Please enter a title.');
    if (!form.course)   return alert('Please enter a course.');
    if (!form.dueDay)   return alert('Please select a day.');
    if (!form.dueMonth) return alert('Please select a month.');
    if (!form.dueDate)  return alert('Please select both day and month.');

    const newTask = {
      title: form.title,
      course: form.course,
      dueDate: form.dueDate,
      priority: form.priority,
      completed: false,
    };

    const saved = await addTask(uid, newTask);
    setDeadlines(prev => [...prev, saved]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const filtered = deadlines.filter(item =>
    filter === 'All' || item.priority === filter.toLowerCase()
  );

  if (loading) return <p>Loading tasks...</p>;

  return (
    <div className="tasks-deadlines-wrapper">

      <div className="tasks-header">
        <h1 className="tasks-title">⚠️ Tasks & Deadlines</h1>
        <button className="add-task-button" onClick={() => setShowForm(true)}>
          + Add Task
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">New Task</h2>

            <label className="modal-label">Title <span className="modal-required">*</span></label>
            <input
              className="modal-input"
              placeholder="e.g. Demo Submission"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />

            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <input
              className="modal-input"
              placeholder="e.g. SWE 381"
              value={form.course}
              onChange={e => setForm({ ...form, course: e.target.value })}
            />

            <label className="modal-label">Due Date <span className="modal-required">*</span></label>
            <div className="modal-row">
              <div className="modal-col">
                <select
                  className="modal-input"
                  value={form.dueDay}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    dueDay: e.target.value,
                    dueDate: prev.dueMonth ? `${prev.dueYear}-${prev.dueMonth}-${e.target.value}` : ''
                  }))}
                >
                  <option value="">Day</option>
                  {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d).padStart(2,'0')}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="modal-col">
                <select
                  className="modal-input"
                  value={form.dueMonth}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    dueMonth: e.target.value,
                    dueDate: prev.dueDay ? `${prev.dueYear}-${e.target.value}-${prev.dueDay}` : ''
                  }))}
                >
                  <option value="">Month</option>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                    <option key={m} value={m}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-col">
                <select
                  className="modal-input"
                  value={form.dueYear}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    dueYear: e.target.value,
                    dueDate: (prev.dueDay && prev.dueMonth) ? `${e.target.value}-${prev.dueMonth}-${prev.dueDay}` : ''
                  }))}
                >
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>
            </div>

            <label className="modal-label">Priority</label>
            <select
              className="modal-input"
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
              <button className="modal-save" onClick={handleAdd}>Add</button>
            </div>
          </div>
        </div>
      )}

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

      <div className="filter-buttons-container">
        {['All', 'High', 'Medium', 'Low'].map(f => (
          <button
            key={f}
            className={`filter-button ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="deadlines-list-container">
        {filtered.length === 0 && (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
            No tasks yet. Click "+ Add Task" to get started.
          </p>
        )}
        {filtered.map(item => (
          <div
            key={item.id}
            className={`deadline-task-card ${item.priority} ${item.completed ? 'task-completed' : ''}`}
          >
            <div className={`priority-badge ${item.priority}`}>{item.priority}</div>

            <div className="task-info-section">
              <div className="task-title">{item.title}</div>
              <div className="task-course-name">{item.course}</div>
              <div className="task-due-date">📅 Due: {item.dueDate}</div>
            </div>

            <div className="task-action-buttons">
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