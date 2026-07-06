import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function clearLocalPwaCacheBeforeRender() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if (hadController && sessionStorage.getItem('pwa-cache-cleared') !== 'true') {
    sessionStorage.setItem('pwa-cache-cleared', 'true');
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
