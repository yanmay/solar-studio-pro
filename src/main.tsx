import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Apply stored theme immediately to prevent flash
try {
  const stored = localStorage.getItem('urja-theme');
  if (stored === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
