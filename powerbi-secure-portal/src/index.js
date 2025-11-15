import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// --- TEMP FIX: Prevent ResizeObserver infinite loop crash ---
if (typeof ResizeObserver !== 'undefined') {
  const OriginalResizeObserver = ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback) {
      const safeCallback = (entries, observer) => {
        try {
          callback(entries, observer);
        } catch (err) {
          // Suppress ResizeObserver loop errors
          if (
            err &&
            err.message &&
            err.message.includes('ResizeObserver loop completed')
          ) {
            console.warn('ResizeObserver error suppressed:', err.message);
          } else {
            throw err;
          }
        }
      };
      this.observer = new OriginalResizeObserver(safeCallback);
    }
    observe(...args) {
      this.observer.observe(...args);
    }
    unobserve(...args) {
      this.observer.unobserve(...args);
    }
    disconnect(...args) {
      this.observer.disconnect(...args);
    }
  };
}
// ------------------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // You can temporarily remove StrictMode if the error still repeats
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);

reportWebVitals();
