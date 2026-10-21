// Which copy of a bed wins when the device and the account disagree. Kept
// free of Firebase so it can be tested on its own.

/**
 * Does the remote copy replace the local one? The higher revision wins; on a
 * tie the later client timestamp. Documents from before revisions existed
 * (`rev` missing) were written with a deep merge and can hold plants deleted
 * long ago, so a local copy always beats them.
 */
export function remoteWins(remote, local) {
  if (!local) return true;
  if (remote.rev === undefined || remote.rev === null) return false;
  const r = Number(remote.rev) || 0, l = Number(local.rev) || 0;
  if (r !== l) return r > l;
  return String(remote.updatedAt || '') > String(local.updatedAt || '');
}
