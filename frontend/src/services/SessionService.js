// file created to mirror CourseService.js for sessions
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

const sessionsRef = (uid) => collection(db, "users", uid, "sessions");

export async function fetchSessions(uid) {
  const snapshot = await getDocs(sessionsRef(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSession(uid, data) {
  const ref = await addDoc(sessionsRef(uid), data);
  return ref.id;
}

export async function updateSession(uid, id, data) {
  await updateDoc(doc(db, "users", uid, "sessions", id), data);
}

export async function deleteSession(uid, id) {
  await deleteDoc(doc(db, "users", uid, "sessions", id));
}