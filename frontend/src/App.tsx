import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader } from './components/Loader';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuthStore } from './store/authStore';

function ProtectedRoute() {
  const { user } = useAuthStore();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

export function App() {
  const { bootstrap, loading, user } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (loading) return <Loader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route path="/*" element={<ProtectedRoute />} />
    </Routes>
  );
}
