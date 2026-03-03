import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Home from './pages/Home';
import GoalGrid from './pages/GoalGrid';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Agents from './pages/Agents';
import SharedGoalView from './pages/SharedGoalView';
import { api } from './api/client';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.getMe();
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">{t('app.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goal/:goalId"
          element={
            <ProtectedRoute>
              <GoalGrid />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents"
          element={<Agents />}
        />
        <Route
          path="/share/:token"
          element={<SharedGoalView />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
