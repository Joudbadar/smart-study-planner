import React from 'react';
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { fetchAllTasks, addTask, updateTask, deleteTask, propagateTaskEdit } from './services/TaskService';
import './ScheduleAndTasks.css';

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY_FORM = { title: '', courseId: '', course: '', dueDate: '', priority: 'medium' };

export default function TasksDeadlines() {
  const [deadlines, setDeadlines]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('All');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingTask, setEditingTask]   = useState(null);
  const [editForm, setEditForm]         = useState(EMPTY_FORM);
  const [courses, setCourses]           = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [uid, setUid]                   = useState(null);

  // ── Custom confirm modal ──
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [confirmTask, setConfirmTask]   = useState(null);

  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setUid(user?.uid ?? null);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;
    fetchAllTasks(uid).then(data => {
      setDeadlines(data);
      setLoading(false);
    });
  }, [uid]);

  useEffect(() => {
    if ((!showForm && !showEditForm) || !uid) return;
    const loadCourses = async () => {
      setLoadingCourses(true);
      try {
        const snapshot = await getDocs(collection(db, 'users', uid, 'courses'));
        setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };
    loadCourses();
  }, [showForm, showEditForm, uid]);

  const courseLabel = (c) =>
    c.code && c.name ? `${c.code} – ${c.name}` : c.code || c.name || c.id;

  const handleCourseChange = (e) => {
    const selectedId = e.target.value;
    const selectedCourse = courses.find(c => c.id === selectedId);
    const label = selectedCourse ? courseLabel(selectedCourse) : '';
    setForm(prev => ({ ...prev, courseId: selectedId, course: label }));
  };

  const handleEditCourseChange = (e) => {
    const selectedId = e.target.value;
    const selectedCourse = courses.find(c => c.id === selectedId);
    const label = selectedCourse ? courseLabel(selectedCourse) : '';
    setEditForm(prev => ({ ...prev, courseId: selectedId, course: label }));
  };

  const handleComplete = async (id, courseId, currentStatus) => {
    await updateTask(uid, courseId, id, { completed: !currentStatus });
    setDeadlines(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
  };

  // ── Custom delete confirm ──
  const handleDeleteClick = (task) => {
    setConfirmTask(task);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    await deleteTask(uid, confirmTask.courseId, confirmTask.id);
    setDeadlines(prev => prev.filter(t => t.id !== confirmTask.id));
    setConfirmTask(null);
  };

  const handleCancelDelete = () => {
    setConfirmOpen(false);
    setConfirmTask(null);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title || '',
      courseId: task.courseId || '',
      course: task.course || '',
      dueDate: task.dueDate || '',
      priority: task.priority || 'medium',
    });
    setShowEditForm(true);
  };

  const handleEditSave = async () => {
    if (!editForm.courseId) return alert('Please select a course.');
    if (!editForm.title)    return alert('Please enter a task title.');
    if (!editForm.dueDate)  return alert('Please select a due date.');
    if (editForm.dueDate < getTodayStr()) return alert('Due date must be today or in the future.');

    const updatedData = {
      title:    editForm.title,
      course:   editForm.course,
      dueDate:  editForm.dueDate,
      priority: editForm.priority,
    };

    await updateTask(uid, editingTask.courseId, editingTask.id, updatedData);

    if (editForm.title !== editingTask.title) {
      try {
        await propagateTaskEdit(uid, editingTask.courseId, editingTask.id, editForm.title);
      } catch (err) {
        console.error('Failed to propagate task edit:', err);
      }
    }

    setDeadlines(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updatedData } : t));
    setShowEditForm(false);
    setEditingTask(null);
  };

  const handleAdd = async () => {
    if (!form.courseId) return alert('Please select a course.');
    if (!form.title)    return alert('Please enter a task title.');
    if (!form.dueDate)  return alert('Please select a due date.');
    if (form.dueDate < getTodayStr()) return alert('Due date must be today or in the future.');

    const newTask = {
      title: form.title,
      course: form.course,
      dueDate: form.dueDate,
      priority: form.priority,
      completed: false,
    };

    const saved = await addTask(uid, form.courseId, newTask);
    setDeadlines(prev => [...prev, saved]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const filtered = deadlines.filter(item => {
    const isDone = item.completed === true;
    if (filter === 'Completed') return isDone;
    if (isDone) return false;
    if (filter === 'All') return true;
    return item.priority === filter.toLowerCase();
  });

  if (loading) return <p>Loading tasks...</p>;

  return (
    <div className="tasks-deadlines-wrapper">

      <div className="tasks-header">
        <h1 className="tasks-title">Tasks & Deadlines</h1>
        <button className="add-task-button" onClick={() => setShowForm(true)}>+ Add Task</button>
      </div>

      {/* ── Add Modal ── */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">New Task</h2>

            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <select className="modal-input" value={form.courseId} onChange={handleCourseChange} disabled={loadingCourses}>
              <option value="">{loadingCourses ? 'Loading courses...' : '— Select a course —'}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
            </select>

            <label className="modal-label">Task Title <span className="modal-required">*</span></label>
            <input className="modal-input" placeholder="e.g. Demo Submission" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />

            <label className="modal-label">Due Date <span className="modal-required">*</span></label>
            <input className="modal-input" type="date" value={form.dueDate} min={getTodayStr()} onChange={e => setForm(prev => ({ ...prev, dueDate: e.target.value }))} />

            <label className="modal-label">Priority</label>
            <select className="modal-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
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

      {/* ── Edit Modal ── */}
      {showEditForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2 className="modal-title">Edit Task</h2>

            <label className="modal-label">Course <span className="modal-required">*</span></label>
            <select className="modal-input" value={editForm.courseId} onChange={handleEditCourseChange} disabled={loadingCourses}>
              <option value="">{loadingCourses ? 'Loading courses...' : '— Select a course —'}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
            </select>

            <label className="modal-label">Task Title <span className="modal-required">*</span></label>
            <input className="modal-input" placeholder="e.g. Demo Submission" value={editForm.title} onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))} />

            <label className="modal-label">Due Date <span className="modal-required">*</span></label>
            <input className="modal-input" type="date" value={editForm.dueDate} min={getTodayStr()} onChange={e => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))} />

            <label className="modal-label">Priority</label>
            <select className="modal-input" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setShowEditForm(false); setEditingTask(null); }}>Cancel</button>
              <button className="modal-save" onClick={handleEditSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Delete Confirm Modal ── */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑</div>
            <h2 className="modal-title">Delete Task?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              This will permanently delete <strong>"{confirmTask?.title}"</strong> and all its sessions. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleCancelDelete}>Cancel</button>
              <button
                className="modal-save"
                onClick={handleConfirmDelete}
                style={{ background: 'linear-gradient(135deg, #f44336, #e57373)' }}
              >
                🗑 Delete
              </button>
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
        {['All', 'High', 'Medium', 'Low', 'Completed'].map(f => (
          <button
            key={f}
            className={`filter-button ${f === 'Completed' ? 'completed-filter' : ''} ${filter === f ? 'active' : ''}`}
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
          <div key={item.id} className={`deadline-task-card ${item.priority} ${item.completed ? 'task-completed' : ''}`}>
            <div className={`priority-badge ${item.completed ? 'completed' : item.priority}`}>
              {item.completed ? 'done' : item.priority}
            </div>
            <div className="task-info-section">
              <div className="task-title">{item.title}</div>
              <div className="task-course-name">{item.course}</div>
              <div className="task-due-date">📅 Due: {formatDate(item.dueDate)}</div>
            </div>
            <div className="task-action-buttons">
              <button className="complete-task-button" onClick={() => handleComplete(item.id, item.courseId, item.completed)}>✓</button>
              <button className="edit-task-button" onClick={() => openEdit(item)}>✎</button>
              <button className="delete-task-button" onClick={() => handleDeleteClick(item)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}