// courseService.js
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const coursesRef = (uid) => collection(db, "users", uid, "courses");

export async function fetchCourses(uid) {
  const snapshot = await getDocs(coursesRef(uid));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((course) => course.name);
}

export async function addCourse(uid, data) {
  const ref = await addDoc(coursesRef(uid), data);
  return ref.id;
}

export async function updateCourse(uid, id, data) {
  await updateDoc(doc(db, "users", uid, "courses", id), data);
}

export async function deleteCourse(uid, id) {
  await deleteDoc(doc(db, "users", uid, "courses", id));
}

/**
 * After editing a course's code/name, propagate the new label
 * to every task and session stored under that course.
 *
 * Affected fields:
 *   - tasks:    { course: "CODE – Name" }
 *   - sessions: { course: "CODE – Name" }
 */
export async function propagateCourseEdit(uid, courseId, newCode, newName) {
  const newLabel = newCode && newName
    ? `${newCode} – ${newName}`
    : newCode || newName || '';

  const batch = writeBatch(db);

  const tasksSnap = await getDocs(
    collection(db, "users", uid, "courses", courseId, "tasks")
  );

  for (const taskDoc of tasksSnap.docs) {
    // Update course label on the task itself
    batch.update(
      doc(db, "users", uid, "courses", courseId, "tasks", taskDoc.id),
      { course: newLabel }
    );

    // Update course label on every session under this task
    const sessionsSnap = await getDocs(
      collection(db, "users", uid, "courses", courseId, "tasks", taskDoc.id, "sessions")
    );
    for (const sessionDoc of sessionsSnap.docs) {
      batch.update(
        doc(db, "users", uid, "courses", courseId, "tasks", taskDoc.id, "sessions", sessionDoc.id),
        { course: newLabel }
      );
    }
  }

  await batch.commit();
}