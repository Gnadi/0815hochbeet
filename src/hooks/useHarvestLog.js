import { useSyncExternalStore } from 'react';
import { addHarvest, deleteHarvest, getHarvests, subscribeHarvests } from '../lib/harvests';

export function useHarvestLog() {
  const entries = useSyncExternalStore(subscribeHarvests, getHarvests, getHarvests);
  return {
    entries,
    addEntry: addHarvest,
    deleteEntry: deleteHarvest,
    entriesForBed: (bedId) => entries.filter(e => e.bedId === bedId),
  };
}
