import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import { Login } from './components/auth/Login';
import { CloudDashboard } from './components/dashboard/CloudDashboard';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        await api.getFiles('');
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        <span>Проверка доступа...</span>
      </div>
    );
  }

  return (
    <div>
      {isAuthenticated ? (
        <CloudDashboard onLogout={() => setIsAuthenticated(false)} />
      ) : (
        <Login onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}