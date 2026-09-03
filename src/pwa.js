// Registers the offline worker and exposes the browser's install prompt so the
// app can be added to a phone's home screen.

let deferredPrompt = null;

export function initPwa() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('hb:installable'));
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; });
}

export function canInstall() { return !!deferredPrompt; }

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}
