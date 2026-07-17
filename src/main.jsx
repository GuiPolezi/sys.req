import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { seedIfNeeded } from './lib/seed';
import { initTheme } from './lib/theme';

// popula dados demo na primeira execução
seedIfNeeded();
// aplica o tema salvo (claro/escuro) antes do primeiro render
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
