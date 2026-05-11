import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import AuthGuard from './components/AuthGuard.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<AuthGuard><App /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><AdminPanel /></AuthGuard>} />
        </Routes>
      </Router>
    </AuthProvider>
  </StrictMode>,
);

