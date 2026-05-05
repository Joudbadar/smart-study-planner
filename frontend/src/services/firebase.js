import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDSO4jQVgFuMECKgwK3uaLHbGvqbVgSRGQ",
  authDomain: "smart-study-planner-61a26.firebaseapp.com",
  projectId: "smart-study-planner-61a26",
  storageBucket: "smart-study-planner-61a26.firebasestorage.app",
  messagingSenderId: "1086084915447",
  appId: "1:1086084915447:web:ce563e67fc78ec9bf573f2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);