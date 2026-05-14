import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// Path: users/{uid}/courses/{courseId}/tasks
const tasksRef = (uid, courseId) =>
  collection(db, "users", uid, "courses", courseId, "tasks");

// Fetch all tasks for a specific course
export async function fetchTasks(uid, courseId) {
  const snapshot = await getDocs(tasksRef(uid, courseId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Fetch ALL tasks across all courses (used by TasksDeadlines for the full list)
export async function fetchAllTasks(uid) {
  const coursesSnap = await getDocs(collection(db, "users", uid, "courses"));
  const allTasks = [];
  for (const courseDoc of coursesSnap.docs) {
    const tasksSnap = await getDocs(tasksRef(uid, courseDoc.id));
    tasksSnap.docs.forEach(d =>
      allTasks.push({ id: d.id, courseId: courseDoc.id, ...d.data() })
    );
  }
  return allTasks;
}

// Add a task under a specific course
export async function addTask(uid, courseId, data) {
  const ref = await addDoc(tasksRef(uid, courseId), data);
  return { id: ref.id, courseId, ...data };
}

// Update a task
export async function updateTask(uid, courseId, id, data) {
  await updateDoc(doc(db, "users", uid, "courses", courseId, "tasks", id), data);
}

// Delete a task
export async function deleteTask(uid, courseId, id) {
  await deleteDoc(doc(db, "users", uid, "courses", courseId, "tasks", id));
}

/**
 * After editing a task's title, propagate the new title
 * to every session stored under that task.
 *
 * Affected fields:
 *   - sessions: { task: "New Task Title" }
 */
export async function propagateTaskEdit(uid, courseId, taskId, newTitle) {
  const batch = writeBatch(db);

  const sessionsSnap = await getDocs(
    collection(db, "users", uid, "courses", courseId, "tasks", taskId, "sessions")
  );

  for (const sessionDoc of sessionsSnap.docs) {
    batch.update(
      doc(db, "users", uid, "courses", courseId, "tasks", taskId, "sessions", sessionDoc.id),
      { task: newTitle }
    );
  }

  await batch.commit();
}