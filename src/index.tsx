
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '../index.css';

// Silencia erros indesejados de WebSocket do Vite no console (comum no ambiente de preview)
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0]?.includes?.('[vite] failed to connect to websocket') || 
        args[0]?.includes?.('WebSocket closed without opened')) {
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message;
    
    if (msg?.includes?.('WebSocket closed without opened') || 
        msg?.includes?.('[vite] failed to connect to websocket')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (event.message?.includes?.('WebSocket closed without opened') || 
        event.message?.includes?.('[vite] failed to connect to websocket')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
