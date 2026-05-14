import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

// Path: users/{uid}/courses/{courseId}/tasks/{taskId}/sessions
const sessionsRef = (uid, courseId, taskId) =>
  collection(db, "users", uid, "courses", courseId, "tasks", taskId, "sessions");

// Fetch sessions for a specific task
export async function fetchSessions(uid, courseId, taskId) {
  const snapshot = await getDocs(sessionsRef(uid, courseId, taskId));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Fetch ALL sessions across all courses and tasks (used by StudySchedule)
export async function fetchAllSessions(uid) {
  console.log('[SessionService] fetchAllSessions called with uid:', uid);
  const coursesSnap = await getDocs(collection(db, "users", uid, "courses"));
  console.log('[SessionService] courses found:', coursesSnap.docs.length);

  const allSessions = [];

  for (const courseDoc of coursesSnap.docs) {
    const tasksSnap = await getDocs(
      collection(db, "users", uid, "courses", courseDoc.id, "tasks")
    );
    console.log(`[SessionService] course ${courseDoc.id} has ${tasksSnap.docs.length} tasks`);

    for (const taskDoc of tasksSnap.docs) {
      const sessionsSnap = await getDocs(
        sessionsRef(uid, courseDoc.id, taskDoc.id)
      );
      console.log(`[SessionService] task ${taskDoc.id} has ${sessionsSnap.docs.length} sessions`);

      sessionsSnap.docs.forEach((d) =>
        allSessions.push({
          id: d.id,
          courseId: courseDoc.id,
          taskId: taskDoc.id,
          ...d.data(),
        })
      );
    }
  }

  console.log('[SessionService] total sessions fetched:', allSessions.length);
  return allSessions;
}

// Add a session under a specific course > task
export async function addSession(uid, courseId, taskId, data) {
  const ref = await addDoc(sessionsRef(uid, courseId, taskId), data);
  return { id: ref.id, courseId, taskId, ...data };
}

// Update a session
export async function updateSession(uid, courseId, taskId, id, data) {
  await updateDoc(
    doc(db, "users", uid, "courses", courseId, "tasks", taskId, "sessions", id),
    data
  );
}

// Delete a session
export async function deleteSession(uid, courseId, taskId, id) {
  await deleteDoc(
    doc(db, "users", uid, "courses", courseId, "tasks", taskId, "sessions", id)
  );
}