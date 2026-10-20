// The Firebase functions the app uses, loaded together by `loadFirebase()`.
//
// Importing `firebase/auth` and `firebase/firestore` as whole namespaces kept
// every export alive, so the chunk carried all of Firestore (and, since SDK 12,
// its pipelines API). Naming the functions here lets the bundler drop the rest;
// add a function here before using it through `authSdk` or `storeSdk`.

export { initializeApp } from 'firebase/app';
export {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
export {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
