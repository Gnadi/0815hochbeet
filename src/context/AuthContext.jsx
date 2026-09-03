import { createContext, useContext, useEffect, useState } from 'react';
import { isFirebaseConfigured, loadFirebase } from '../firebase';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still resolving, null = signed out.
  const [user, setUser] = useState(() => (isFirebaseConfigured() ? undefined : null));

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let unsub = () => {};
    let alive = true;
    loadFirebase().then(fb => {
      if (!alive) return;
      if (!fb) { setUser(null); return; }
      unsub = fb.authSdk.onAuthStateChanged(fb.auth, u => setUser(u ?? null));
    });
    return () => { alive = false; unsub(); };
  }, []);

  async function login(email, pw) {
    const fb = await loadFirebase();
    if (!fb) throw new Error('Firebase ist nicht konfiguriert.');
    return fb.authSdk.signInWithEmailAndPassword(fb.auth, email, pw);
  }

  async function register(email, pw, name) {
    const fb = await loadFirebase();
    if (!fb) throw new Error('Firebase ist nicht konfiguriert.');
    const res = await fb.authSdk.createUserWithEmailAndPassword(fb.auth, email, pw);
    await fb.authSdk.updateProfile(res.user, { displayName: name });
    return res;
  }

  async function logout() {
    const fb = await loadFirebase();
    if (fb) await fb.authSdk.signOut(fb.auth);
  }

  return (
    <Ctx.Provider value={{ user, login, register, logout, syncAvailable: isFirebaseConfigured() }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
