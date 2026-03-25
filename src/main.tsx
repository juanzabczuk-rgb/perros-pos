import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign WebSocket errors in the AI Studio sandbox environment
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('WebSocket closed without opened') ||
    event.reason?.message?.includes('failed to connect to websocket')
  ) {
    event.preventDefault();
  }
});

window.onerror = (message) => {
  if (message.toString().includes('WebSocket closed without opened')) {
    return true; // Suppress error
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
