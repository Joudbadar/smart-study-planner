// CourseManagement.jsx — scoped to authenticated user
import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import "./CourseManagement.css";
import { fetchCourses, addCourse, updateCourse, deleteCourse, propagateCourseEdit } from "./services/CourseService";
import React from 'react';

const emptyForm = { name: "", code: "", instructor: "", creditHours: "", hoursPerWeek: "", semester: "", difficulty: "" };

const SEMESTERS    = ["Summer 2026", "Fall 2026", "Spring 2027", "Summer 2027", "Fall 2027"];
const CREDIT_HOURS = [1, 2, 3, 4, 5, 6];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Very Hard"];

const DIFF_STYLES = {
  Easy:        { stripe: "#4caf50", badgeBg: "#e8f5e9", badgeText: "#2e7d32" },
  Medium:      { stripe: "#ff9800", badgeBg: "#fff3e0", badgeText: "#e65100" },
  Hard:        { stripe: "#e67a5f", badgeBg: "#ffeee6", badgeText: "#bf360c" },
  "Very Hard": { stripe: "#f44336", badgeBg: "#ffebee", badgeText: "#b71c1c" },
};

export default function CourseManagement() {
  const [courses, setCourses]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [form, setForm]               = useState(emptyForm);
  const [errors, setErrors]           = useState({});
  const [propagating, setPropagating] = useState(false);

  const [confirmOpen, setConfirmOpen]         = useState(false);
  const [confirmCourseId, setConfirmCourseId] = useState(null);

  const uid = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    (async () => {
      try {
        const data = await fetchCourses(uid);
        setCourses(data);
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const totalCredits = courses.reduce((s, c) => s + (Number(c.creditHours)  || 0), 0);
  const totalHours   = courses.reduce((s, c) => s + (Number(c.hoursPerWeek) || 0), 0);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setErrors({}); setModalOpen(true); };

  const openEdit = (course) => {
    setEditingId(course.id);
    setForm({
      name: course.name, code: course.code, instructor: course.instructor,
      creditHours: String(course.creditHours), hoursPerWeek: String(course.hoursPerWeek),
      semester: course.semester, difficulty: course.difficulty,
    });
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingId(null); };

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name        = "Required";
    if (!form.instructor.trim()) e.instructor   = "Required";
    if (!form.creditHours)       e.creditHours  = "Required";
    if (!form.hoursPerWeek)                  e.hoursPerWeek = "Required";
    else if (Number(form.hoursPerWeek) < 1)  e.hoursPerWeek = "Minimum is 1 hour per week.";
    else if (Number(form.hoursPerWeek) > 6)  e.hoursPerWeek = "Maximum is 6 hours per week.";
    if (!form.semester)          e.semester     = "Required";
    if (!form.difficulty)        e.difficulty   = "Required";

    // Check duplicate name + code
    const duplicate = courses.find(c =>
      c.id !== editingId &&
      c.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      (c.code || '').trim().toLowerCase() === (form.code || '').trim().toLowerCase()
    );
    if (duplicate) e.name = "A course with the same name and code already exists.";

    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const data = {
      ...form,
      creditHours:  Number(form.creditHours),
      hoursPerWeek: Number(form.hoursPerWeek),
    };

    try {
      if (editingId !== null) {
        await updateCourse(uid, editingId, data);
        setCourses(cs => cs.map(c => c.id === editingId ? { id: editingId, ...data } : c));

        const original = courses.find(c => c.id === editingId);
        if (original?.code !== form.code || original?.name !== form.name) {
          setPropagating(true);
          try {
            await propagateCourseEdit(uid, editingId, form.code, form.name);
          } catch (err) {
            console.error("Failed to propagate course edit:", err);
          } finally {
            setPropagating(false);
          }
        }
      } else {
        const newId = await addCourse(uid, data);
        setCourses(cs => [...cs, { id: newId, ...data }]);
      }
    } catch (err) {
      console.error("Failed to save course:", err);
    }

    closeModal();
  };

  const handleRemoveClick = (id) => {
    setConfirmCourseId(id);
    setConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    setConfirmOpen(false);
    try {
      await deleteCourse(uid, confirmCourseId);
      setCourses(cs => cs.filter(c => c.id !== confirmCourseId));
    } catch (err) {
      console.error("Failed to delete course:", err);
    }
    setConfirmCourseId(null);
  };

  const handleCancelRemove = () => {
    setConfirmOpen(false);
    setConfirmCourseId(null);
  };

  return (
    <div className="w-full  ">
      <div className="cm-bg-texture" />

      <header className="cm-header">
        <h1 className="cm-title">Manage Your Courses</h1>
      </header>

      <div className="cm-summary">
        <div className="cm-chip">Total Credits <span>{totalCredits}</span></div>
        <div className="cm-chip">Weekly Hours <span>{totalHours}</span></div>
        <div className="cm-chip">Courses <span>{courses.length}</span></div>
        <button className="cm-add-btn" onClick={openAdd}>＋ Add Course</button>
      </div>

      {propagating && (
        <p style={{ textAlign: "center", color: "#7a7a7a", padding: "8px 0" }}>
          Updating tasks and sessions…
        </p>
      )}

      {loading && (
        <p style={{ textAlign: "center", color: "#7a7a7a", padding: "40px 0" }}>
          Loading courses…
        </p>
      )}

      {!loading && !uid && (
        <p style={{ textAlign: "center", color: "#7a7a7a", padding: "40px 0" }}>
          Please log in to view your courses.
        </p>
      )}

      {!loading && uid && (
        <div className="cm-courses-grid">
          {courses.length === 0 && (
            <div className="cm-empty">
              <p className="cm-empty-icon">📚</p>
              <h3>No courses yet</h3>
              <p>Click "Add Course" to get started</p>
            </div>
          )}

          {courses.map((course) => {
            const ds = DIFF_STYLES[course.difficulty] || DIFF_STYLES["Medium"];
            return (
              <div key={course.id} className="cm-course-card" style={{ "--stripe-color": ds.stripe }}>
                <div className="cm-card-top">
                  <div className="cm-card-title-group">
                    <h3 className="cm-course-name">{course.name}</h3>
                    {course.code && <span className="cm-course-code">{course.code}</span>}
                  </div>
                  <span className="cm-diff-badge" style={{ background: ds.badgeBg, color: ds.badgeText }}>
                    {course.difficulty}
                  </span>
                </div>

                <div className="cm-course-meta">
                  <div className="cm-meta-item cm-meta-full">
                    <div className="cm-meta-label">Instructor</div>
                    <div className="cm-meta-value">{course.instructor || "—"}</div>
                  </div>
                  <div className="cm-meta-item">
                    <div className="cm-meta-label">Credit Hours</div>
                    <div className="cm-meta-value">{course.creditHours} cr</div>
                  </div>
                  <div className="cm-meta-item">
                    <div className="cm-meta-label">Hours / Week</div>
                    <div className="cm-meta-value">{course.hoursPerWeek} hrs</div>
                  </div>
                  <div className="cm-meta-item cm-meta-full">
                    <div className="cm-meta-label">Semester</div>
                    <div className="cm-meta-value">{course.semester || "—"}</div>
                  </div>
                </div>

                <div className="cm-card-actions">
                  <button className="cm-btn-edit"   onClick={() => openEdit(course)}>✏ Edit</button>
                  <button className="cm-btn-remove" onClick={() => handleRemoveClick(course.id)}>🗑 Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Custom Confirm Modal ── */}
      {confirmOpen && (
        <div className="cm-overlay" onClick={handleCancelRemove}>
          <div className="cm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗑</div>
            <h2 className="cm-modal-title">Remove Course?</h2>
            <p style={{ color: '#777', fontSize: '14px', margin: '8px 0 24px' }}>
              This will permanently remove the course and all its data. This action cannot be undone.
            </p>
            <div className="cm-modal-actions">
              <button className="cm-btn-cancel" onClick={handleCancelRemove}>Cancel</button>
              <button className="cm-btn-primary" onClick={handleConfirmRemove} style={{ background: 'linear-gradient(135deg, #f44336, #e57373)' }}>
                🗑 Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="cm-modal">
            <h2 className="cm-modal-title">{editingId ? "Edit Course" : "Add Course"}</h2>

            <div className="cm-form-group">
              <label className="cm-label">Course Name <span className="cm-req">*</span></label>
              <input className={`cm-input ${errors.name ? "cm-err" : ""}`} placeholder="e.g., Web Applications Development" value={form.name} onChange={e => handleChange("name", e.target.value)} />
              {errors.name && <span className="cm-error-msg">{errors.name}</span>}
            </div>

            <div className="cm-form-group">
              <label className="cm-label">Course Code</label>
              <input className={`cm-input ${errors.code ? "cm-err" : ""}`} placeholder="e.g., SWE 381" value={form.code} onChange={e => handleChange("code", e.target.value)} />
              {errors.code && <span className="cm-error-msg">{errors.code}</span>}
            </div>

            <div className="cm-form-group">
              <label className="cm-label">Instructor <span className="cm-req">*</span></label>
              <input className={`cm-input ${errors.instructor ? "cm-err" : ""}`} placeholder="e.g., Dr. Ahmed Ali" value={form.instructor} onChange={e => handleChange("instructor", e.target.value)} />
              {errors.instructor && <span className="cm-error-msg">{errors.instructor}</span>}
            </div>

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label className="cm-label">Credit Hours <span className="cm-req">*</span></label>
                <select className={`cm-select ${errors.creditHours ? "cm-err" : ""}`} value={form.creditHours} onChange={e => handleChange("creditHours", e.target.value)}>
                  <option value="">— select —</option>
                  {CREDIT_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {errors.creditHours && <span className="cm-error-msg">{errors.creditHours}</span>}
              </div>
              <div className="cm-form-group">
                <label className="cm-label">Hours / Week <span className="cm-req">*</span></label>
                <select className={`cm-select ${errors.hoursPerWeek ? "cm-err" : ""}`} value={form.hoursPerWeek} onChange={e => handleChange("hoursPerWeek", e.target.value)}>
                  <option value="">— select —</option>
                  {[1,2,3,4,5,6].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {errors.hoursPerWeek && <span className="cm-error-msg">{errors.hoursPerWeek}</span>}
              </div>
            </div>

            <div className="cm-form-row">
              <div className="cm-form-group">
                <label className="cm-label">Semester <span className="cm-req">*</span></label>
                <select className={`cm-select ${errors.semester ? "cm-err" : ""}`} value={form.semester} onChange={e => handleChange("semester", e.target.value)}>
                  <option value="">— select —</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.semester && <span className="cm-error-msg">{errors.semester}</span>}
              </div>
              <div className="cm-form-group">
                <label className="cm-label">Difficulty <span className="cm-req">*</span></label>
                <select className={`cm-select ${errors.difficulty ? "cm-err" : ""}`} value={form.difficulty} onChange={e => handleChange("difficulty", e.target.value)}>
                  <option value="">— select —</option>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.difficulty && <span className="cm-error-msg">{errors.difficulty}</span>}
              </div>
            </div>

            <div className="cm-modal-actions">
              <button className="cm-btn-cancel"  onClick={closeModal}>Cancel</button>
              <button className="cm-btn-primary" onClick={handleSave}>{editingId ? "Update Course" : "✓ Save Course"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}