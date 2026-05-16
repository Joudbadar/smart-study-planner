// TasksDeadlines.jsx
import React from 'react';
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { fetchAllTasks, addTask, updateTask, deleteTask, propagateTaskEdit } from './services/TaskService';
import { fetchSessions, updateSession } from './services/SessionService';
import './TasksDeadlines.css';

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
const PRIORITIES = ["high", "medium", "low"];
const PRIORITY_STYLES = {
  high:   { stripe: "#f44336", badgeBg: "#ffebee", badgeText: "#b71c1c" },
  medium: { stripe: "#ff9800", badgeBg: "#fff3e0", badgeText: "#e65100" },
  low:    { stripe: "#4caf50", badgeBg: "#e8f5e9", badgeText: "#2e7d32" },
};
const MODAL_NONE = null;

export default function TasksDeadlines() {
  const [deadlines, setDeadlines]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState('All');
  const [modalOpen, setModalOpen]           = useState(false);
  const [editingId, setEditingId]           = useState(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [errors, setErrors]                 = useState({});
  const [courses, setCourses]               = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [uid, setUid]                       = useState(null);
  const [actionModal, setActionModal]       = useState(MODAL_NONE);

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
    if (!modalOpen || !uid) return;
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
  }, [modalOpen, uid]);

  const courseLabel = (c) =>
    c.code && c.name ? `${c.code} – ${c.name}` : c.code || c.name || c.id;

  const openAdd  = () => { setEditingId(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true); };
  const openEdit = (task) => {
    setEditingId(task.id);
    setForm({ title: task.title || '', courseId: task.courseId || '', course: task.course || '', dueDate: task.dueDate || '', priority: task.priority || 'medium' });
    setErrors({});
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingId(null); };

  const handleChange = (field, value) => {
    setForm(f  => ({ ...f,  [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const handleCourseChange = (e) => {
    const selectedId     = e.target.value;
    const selectedCourse = courses.find(c => c.id === selectedId);
    const label          = selectedCourse ? courseLabel(selectedCourse) : '';
    setForm(prev  => ({ ...prev, courseId: selectedId, course: label }));
    setErrors(prev => ({ ...prev, courseId: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.courseId)       e.courseId = 'Please select a course.';
    if (!form.title.trim())   e.title    = 'Please enter a task title.';
    if (!form.dueDate)        e.dueDate  = 'Please select a due date.';
    else if (form.dueDate < getTodayStr()) e.dueDate = 'Due date must be today or in the future.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    if (editingId !== null) {
      const updatedData = { title: form.title, course: form.course, dueDate: form.dueDate, priority: form.priority };
      const original = deadlines.find(t => t.id === editingId);
      await updateTask(uid, original.courseId, editingId, updatedData);
      if (form.title !== original.title) {
        try { await propagateTaskEdit(uid, original.courseId, editingId, form.title); }
        catch (err) { console.error('Failed to propagate task edit:', err); }
      }
      setDeadlines(prev => prev.map(t => t.id === editingId ? { ...t, ...updatedData } : t));
    } else {
      const newTask = { title: form.title, course: form.course, dueDate: form.dueDate, priority: form.priority, completed: false };
      const saved = await addTask(uid, form.courseId, newTask);
      setDeadlines(prev => [...prev, saved]);
    }
    // Auto-generate plan when new task is added
      const { generateFullPlan } = await import('./StudySchedule');
    closeModal();
  };

  // Mark task as complete + mark all its sessions as completed
  const handleConfirmComplete = async () => {
    const { task } = actionModal;
    setActionModal(MODAL_NONE);

    await updateTask(uid, task.courseId, task.id, { completed: true });
    setDeadlines(prev => prev.map(t => t.id === task.id ? { ...t, completed: true } : t));

    try {
      const sessions = await fetchSessions(uid, task.courseId, task.id);
      for (const session of sessions) {
        if (session.status !== 'completed') {
          await updateSession(uid, task.courseId, task.id, session.id, { status: 'completed' });
        }
      }
    } catch (err) {
      console.error('Failed to complete sessions:', err);
    }
  };

  const handleConfirmDelete = async () => {
    const { task } = actionModal;
    setActionModal(MODAL_NONE);
    await deleteTask(uid, task.courseId, task.id);
    setDeadlines(prev => prev.filter(t => t.id !== task.id));
  };

  const closeActionModal = () => setActionModal(MODAL_NONE);

  const filtered = deadlines.filter(item => {
    const isDone = item.completed === true;
    if (filter === 'Completed') return isDone;
    if (isDone) return false;
    if (filter === 'All') return true;
    return item.priority === filter.toLowerCase();
  });

  if (loading) return <p style={{ textAlign: 'center', color: '#7a7a7a', padding: '40px 0' }}>Loading tasks…</p>;

  return (
    <div className="w-full">
      <header className="cm-header">
        <h1 className="cm-title">Tasks & Deadlines</h1>
        <p className="cm-subtitle">Track your assignments, projects, and study priorities</p>
      </header>

      <div className="cm-summary">
        <div className="cm-chip">Total Tasks <span>{deadlines.length}</span></div>
        <div className="cm-chip">High Priority <span>{deadlines.filter(d => d.priority === 'high').length}</span></div>
        <div className="cm-chip">Completed <span>{deadlines.filter(d => d.completed).length}</span></div>
        <button className="cm-add-btn" onClick={openAdd}>＋ Add Task</button>
      </div>

      <div className="filter-buttons-container">
        {['All', 'High', 'Medium', 'Low', 'Completed'].map(f => (
          <button key={f} className={`filter-button ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {!uid && <p style={{ textAlign: 'center', color: '#7a7a7a', padding: '40px 0' }}>Please log in to view your tasks.</p>}

      {uid && (
        <div className="cm-courses-grid">
          {filtered.length === 0 && (
            <div className="cm-empty">
              <p className="cm-empty-icon">📝</p>
              <h3>No tasks found</h3>
              <p>There are no tasks matching your selection</p>
            </div>
          )}

          {filtered.map((item) => {
            const ps = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES['medium'];
            return (
              <div key={item.id} className={`cm-course-card ${item.completed ? 'task-completed' : ''}`} style={{ '--stripe-color': item.completed ? '#4caf50' : ps.stripe }}>
                <div className="cm-card-top">
                  <div className="cm-card-title-group">
                    <h3 className="cm-course-name" style={{ textDecoration: item.completed ? 'line-through' : 'none' }}>
                      {item.title}
                    </h3>
                    {item.course && <span className="cm-course-code">{item.course}</span>}
                  </div>
                  <span className="cm-diff-badge" style={{ background: item.completed ? '#e8f5e9' : ps.badgeBg, color: item.completed ? '#2e7d32' : ps.badgeText }}>
                    {item.completed ? 'Done' : item.priority}
                  </span>
                </div>

                <div className="cm-course-meta">
                  <div className="cm-meta-item cm-meta-full">
                    <div className="cm-meta-label">Due Date</div>
                    <div className="cm-meta-value" style={{ color: item.completed ? '#bbb' : '#2d2d2d' }}>
                      📅 {formatDate(item.dueDate)}
                    </div>
                  </div>
                </div>

                <div className="cm-card-actions">
                  {!item.completed && (
                    <button className="cm-btn-done" onClick={() => setActionModal({ type: 'complete', task: item })}>✓ Done</button>
                  )}
                  {!item.completed && (
                    <button className="cm-btn-edit" onClick={() => openEdit(item)}>✏ Edit</button>
                  )}
                  <button className="cm-btn-remove" onClick={() => setActionModal({ type: 'delete', task: item })}>🗑 Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Modal */}
      {actionModal?.type === 'complete' && (
        <div className="cm-overlay" onClick={closeActionModal}>
          <div className="cm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h2 className="cm-modal-title">Mark as Complete?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              Are you sure you want to mark <strong>"{actionModal.task?.title}"</strong> as done? All its study sessions will also be marked as completed.
            </p>
            <div className="cm-modal-actions">
              <button className="cm-btn-cancel" onClick={closeActionModal}>Cancel</button>
              <button className="cm-btn-primary" onClick={handleConfirmComplete} style={{ background: 'linear-gradient(135deg, #4caf50, #81c784)' }}>
                ✓ Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {actionModal?.type === 'delete' && (
        <div className="cm-overlay" onClick={closeActionModal}>
          <div className="cm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑</div>
            <h2 className="cm-modal-title">Delete Task?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              This will permanently delete <strong>"{actionModal.task?.title}"</strong> and all its sessions.
            </p>
            <div className="cm-modal-actions">
              <button className="cm-btn-cancel" onClick={closeActionModal}>Cancel</button>
              <button className="cm-btn-primary" onClick={handleConfirmDelete} style={{ background: 'linear-gradient(135deg, #f44336, #e57373)' }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="cm-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="cm-modal">
            <h2 className="cm-modal-title">{editingId ? 'Edit Task' : 'Add Task'}</h2>

            <div className="cm-form-group">
              <label className="cm-label">Course <span className="cm-req">*</span></label>
              <select className={`cm-select ${errors.courseId ? 'cm-err' : ''}`} value={form.courseId} onChange={handleCourseChange} disabled={loadingCourses}>
                <option value="">{loadingCourses ? 'Loading courses...' : '— select —'}</option>
                {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
              </select>
              {errors.courseId && <span className="cm-error-msg">{errors.courseId}</span>}
            </div>

            <div className="cm-form-group">
              <label className="cm-label">Task Title <span className="cm-req">*</span></label>
              <input className={`cm-input ${errors.title ? 'cm-err' : ''}`} placeholder="e.g., Demo Submission" value={form.title} onChange={e => handleChange('title', e.target.value)} />
              {errors.title && <span className="cm-error-msg">{errors.title}</span>}
            </div>

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label className="cm-label">Due Date <span className="cm-req">*</span></label>
                <input type="date" className={`cm-input ${errors.dueDate ? 'cm-err' : ''}`} value={form.dueDate} min={getTodayStr()} onChange={e => handleChange('dueDate', e.target.value)} />
                {errors.dueDate && <span className="cm-error-msg">{errors.dueDate}</span>}
              </div>
              <div className="cm-form-group">
                <label className="cm-label">Priority</label>
                <select className="cm-select" value={form.priority} onChange={e => handleChange('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="cm-modal-actions">
              <button className="cm-btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="cm-btn-primary" onClick={handleSave}>{editingId ? 'Update Task' : '✓ Save Task'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}