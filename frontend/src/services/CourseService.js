// courseService.js
// ─────────────────────────────────────────────────────────────
// All Firestore operations scoped to each user's subcollection:
//   users/{uid}/courses/{courseId}
// ─────────────────────────────────────────────────────────────
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

/** Returns a reference to the current user's courses subcollection */
const coursesRef = (uid) => collection(db, "users", uid, "courses");

/** Fetch all courses for a given user */
export async function fetchCourses(uid) {
  const snapshot = await getDocs(coursesRef(uid));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((course) => course.name); // skip incomplete/empty documents
}

/** Add a new course for a given user; returns the new Firestore document id */
export async function addCourse(uid, data) {
  const ref = await addDoc(coursesRef(uid), data);
  return ref.id;
}

/** Update an existing course for a given user */
export async function updateCourse(uid, id, data) {
  await updateDoc(doc(db, "users", uid, "courses", id), data);
}

/** Delete a course for a given user */
export async function deleteCourse(uid, id) {
  await deleteDoc(doc(db, "users", uid, "courses", id));
}