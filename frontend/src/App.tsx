import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader } from './components/Loader';
import { useAuthStore } from './store/authStore';

const AppLayout = lazy(() => import('./layouts/AppLayout').then((module) => ({ default: module.AppLayout })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));

function ProtectedRoute() {
  const { user } = useAuthStore();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

export function App() {
  const { bootstrap, loading, user } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const logout = () => useAuthStore.getState().logout();
    window.addEventListener('sync:unauthorized', logout);
    return () => window.removeEventListener('sync:unauthorized', logout);
  }, []);

  if (loading) return <Loader />;

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/*" element={<ProtectedRoute />} />
      </Routes>
    </Suspense>
  );
}
