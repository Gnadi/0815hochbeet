import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useCallback, useRef } from 'react';

export function useFirestoreBed(uid, bedId) {
  const timer = useRef(null);

  const saveField = useCallback((field, value) => {
    if (!uid || !bedId || !db) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const ref = doc(db, 'users', uid, 'beds', bedId);
      updateDoc(ref, { [field]: value, updatedAt: serverTimestamp() }).catch(() =>
        setDoc(ref, { [field]: value, updatedAt: serverTimestamp() }, { merge: true })
      );
    }, 800);
  }, [uid, bedId]);

  const saveBed = useCallback((data) => {
    if (!uid || !bedId || !db) return;
    const ref = doc(db, 'users', uid, 'beds', bedId);
    setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [uid, bedId]);

  return { saveField, saveBed };
}
