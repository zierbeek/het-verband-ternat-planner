import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './mobile.css';
import {initTheme} from './utils/theme.ts';

// Applies the persisted theme choice (or system preference) and keeps
// listening for system changes. The inline script in index.html already
// set the `.dark` class before this file loaded, to avoid a flash.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for installable PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker registration failed:', err));
  });
} else if ('serviceWorker' in navigator) {
  // In development, also register for testing, or optional
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[PWA Dev] Service Worker registered:', reg.scope))
      .catch((err) => console.error('[PWA Dev] Service Worker registration failed:', err));
  });
}

