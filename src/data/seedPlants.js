// Mirrors the plant library into Firestore (plants/{id}) once per project, so
// the data is available to anything else built on the same backend.

import { loadFirebase } from '../firebase';
import { PLANTS, COMPANIONS } from './plants';

let seeded = false;

export async function seedPlantsToFirestore() {
  if (seeded) return;
  const fb = await loadFirebase();
  if (!fb) return;
  const { collection, getDocs, writeBatch, doc } = fb.storeSdk;
  try {
    const snap = await getDocs(collection(fb.db, 'plants'));
    if (!snap.empty) { seeded = true; return; }
    const batch = writeBatch(fb.db);
    PLANTS.forEach(plant => {
      batch.set(doc(fb.db, 'plants', plant.id), { ...plant, companions: COMPANIONS[plant.id] || {} });
    });
    await batch.commit();
    seeded = true;
  } catch {
    // Firestore unavailable or rules deny writes — the app runs on local data.
  }
}

export async function loadPlantsFromFirestore() {
  const fb = await loadFirebase();
  if (!fb) return null;
  try {
    const snap = await fb.storeSdk.getDocs(fb.storeSdk.collection(fb.db, 'plants'));
    return snap.empty ? null : snap.docs.map(d => d.data());
  } catch {
    return null;
  }
}
