import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import { App } from './App';
import { db } from './db/db';
import { ensureSeeded } from './db/seed';

async function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  try {
    await db.open();
    await ensureSeeded(db);
    // Ask the browser not to evict the library under storage pressure.
    void navigator.storage?.persist?.();
  } catch (e) {
    root.render(
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>FRAMEWORK could not open its local database.</h1>
        <p>{e instanceof Error ? e.message : String(e)}</p>
        <p>Private browsing or blocked site data can prevent IndexedDB from working.</p>
      </div>,
    );
    return;
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
