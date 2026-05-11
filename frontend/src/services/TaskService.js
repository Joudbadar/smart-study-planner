// file created to mirror CourseService.js for tasks
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

const tasksRef = (uid) => collection(db, "users", uid, "tasks");

export async function fetchTasks(uid) {
  const snapshot = await getDocs(tasksRef(uid));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addTask(uid, data) {
  const ref = await addDoc(tasksRef(uid), data);
  return { id: ref.id, ...data };
}

export async function updateTask(uid, id, data) {
  await updateDoc(doc(db, "users", uid, "tasks", id), data);
}

export async function deleteTask(uid, id) {
  await deleteDoc(doc(db, "users", uid, "tasks", id));
}