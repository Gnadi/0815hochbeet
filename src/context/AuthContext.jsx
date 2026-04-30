import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, u => setUser(u ?? null));
  }, []);

  const login = (email, pw) => {
    if (!auth) return Promise.reject(new Error('Firebase not configured'));
    return signInWithEmailAndPassword(auth, email, pw);
  };
  const register = (email, pw, name) => {
    if (!auth) return Promise.reject(new Error('Firebase not configured'));
    return createUserWithEmailAndPassword(auth, email, pw).then(r => updateProfile(r.user, { displayName: name }));
  };
  const logout = () => {
    if (!auth) return Promise.resolve();
    return signOut(auth);
  };

  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
