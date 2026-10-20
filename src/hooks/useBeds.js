import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '../lib/beds';

/**
 * Live list of every bed, normalised by the store. The array and its beds keep
 * their identity until something changes, so memos depending on them hold.
 */
export function useBeds() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Live single bed, or `null` while it does not exist (yet). */
export function useBedRecord(bedId) {
  const beds = useBeds();
  return beds.find(b => b.id === bedId) || null;
}
