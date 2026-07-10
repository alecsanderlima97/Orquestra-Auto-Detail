import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const CACHE_VERSION = '2026-07-10-plans-ai-widget';

async function clearLocalPwaCacheBeforeRender() {
  if (!('serviceWorker' in navigator)) return;

  const shouldClear =
    import.meta.env.DEV ||
    localStorage.getItem('app-cache-version') !== CACHE_VERSION;

  if (!shouldClear) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  localStorage.setItem('app-cache-version', CACHE_VERSION);

  if (hadController && sessionStorage.getItem('pwa-cache-cleared') !== CACHE_VERSION) {
    sessionStorage.setItem('pwa-cache-cleared', CACHE_VERSION);
    window.location.replace(`${window.location.origin}${window.location.pathname}?cache=limpo`);
    return new Promise(() => {});
  }
}

async function start() {
  await clearLocalPwaCacheBeforeRender();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start().catch((error) => {
  console.error('Erro ao iniciar sistema:', error);
});
