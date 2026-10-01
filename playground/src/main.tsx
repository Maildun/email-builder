import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@maildun/email-builder/editor.css';
import './playground.css';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
