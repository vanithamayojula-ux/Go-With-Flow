import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initErrorMonitoring, GameErrorBoundary } from './utils/errorMonitoring';

initErrorMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  </StrictMode>,
);
