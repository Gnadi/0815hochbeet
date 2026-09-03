import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, normalizeBed } from '../lib/beds';

/** Live list of every bed, normalised. Re-renders whenever the store changes. */
export function useBeds() {
  const beds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return beds.map(normalizeBed);
}

/** Live single bed, or `null` while it does not exist (yet). */
export function useBedRecord(bedId) {
  const beds = useBeds();
  return beds.find(b => b.id === bedId) || null;
}
