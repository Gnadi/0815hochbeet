// Firebase is loaded on demand.
//
// The planner is local-first: every bed lives in localStorage and the app is
// fully usable signed out. Pulling ~450 kB of SDK into the first paint just to
// find out nobody is signed in was the single biggest cost on a phone, so the
// SDK is now imported only once it is actually needed.

const CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when real credentials are configured — checked without loading the SDK. */
export function isFirebaseConfigured() {
  return Boolean(CONFIG.apiKey && CONFIG.projectId && CONFIG.apiKey !== 'placeholder');
}

let pending = null;

/** Resolves to `{ app, auth, db, authSdk, storeSdk }`, or `null` when Firebase is unavailable. */
export function loadFirebase() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  pending ||= (async () => {
    try {
      const sdk = await import('./firebaseSdk.js');
      const app = sdk.initializeApp(CONFIG);
      return { app, auth: sdk.getAuth(app), db: sdk.getFirestore(app), authSdk: sdk, storeSdk: sdk };
    } catch {
      return null;
    }
  })();
  return pending;
}
