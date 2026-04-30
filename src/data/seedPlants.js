// Seeds plant + companion data to Firestore on first run.
// Firestore structure: plants/{plantId} (fields match PLANTS array + companions map)
// Called once from App.jsx when a user is signed in (or anonymously).

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { PLANTS, COMPANIONS } from './plants';

let seeded = false;

export async function seedPlantsToFirestore() {
  if (seeded || !db) return;
  try {
    const snap = await getDocs(collection(db, 'plants'));
    if (!snap.empty) { seeded = true; return; } // already seeded

    const batch = writeBatch(db);
    PLANTS.forEach(plant => {
      const ref = doc(db, 'plants', plant.id);
      batch.set(ref, {
        ...plant,
        companions: COMPANIONS[plant.id] || {},
      });
    });
    await batch.commit();
    seeded = true;
  } catch (e) {
    // Firestore not configured — app works with local data
  }
}

// Load plants from Firestore (falls back to local PLANTS if unavailable)
export async function loadPlantsFromFirestore() {
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'plants'));
    if (snap.empty) return null;
    return snap.docs.map(d => d.data());
  } catch {
    return null;
  }
}
