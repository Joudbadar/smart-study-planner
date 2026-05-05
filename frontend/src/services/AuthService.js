import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  updateProfile, 
  sendEmailVerification 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Sign up a new user
 */
export async function signUp({ fullName, email, password }) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  await updateProfile(user, { displayName: fullName });
  await sendEmailVerification(user);

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    fullName: fullName,
    email: email,
    createdAt: new Date().toISOString(),
    role: "student",
    emoji: '\u{1F427}',
  });

  return user;
}

/**
 * Sign in an existing user
 */
export async function signIn({ email, password }) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (!user.emailVerified) {
    await signOut(auth);
    const error = new Error('Email not verified');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  return user;
}

/**
 * Sign out the current user
 */
export async function signOutUser() {
  await signOut(auth);
}

/**
 * Convert Firebase auth error codes to user-friendly messages
 */
export function getAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/email-not-verified':
      return 'Please verify your email before signing in. Check your inbox.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    default:
      return 'Something went wrong. Please try again.';
  }
}