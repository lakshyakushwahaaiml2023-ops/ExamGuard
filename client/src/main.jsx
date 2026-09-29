import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TrustLedgerPage from './pages/TrustLedgerPage.jsx';
import CandidateExamPage from './pages/CandidateExamPage.jsx';
import DecisionsPage from './pages/DecisionsPage.jsx';
import PublicStatusPage from './pages/PublicStatusPage.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to /admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/ledger" element={<TrustLedgerPage />} />
          <Route path="/decisions" element={<DecisionsPage />} />
          <Route path="/status" element={<PublicStatusPage />} />
          <Route path="/exam" element={<CandidateExamPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
