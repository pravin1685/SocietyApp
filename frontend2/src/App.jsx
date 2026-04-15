import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FlatDirectory from './pages/FlatDirectory';
import Maintenance from './pages/Maintenance';
import Outstanding from './pages/Outstanding';
import Ledger from './pages/Ledger';
import Reports from './pages/Reports';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Notices from './pages/Notices';
import PendingReminders from './pages/PendingReminders';
import DocumentVault from './pages/DocumentVault';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-900">
      <div className="text-center text-white">
        <div className="text-5xl mb-4">🏢</div>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto"></div>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/flats" element={<ProtectedRoute><FlatDirectory /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
      <Route path="/outstanding" element={<ProtectedRoute><Outstanding /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/users"     element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/notices"   element={<ProtectedRoute><Notices /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><PendingReminders /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentVault /></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000,
          style: { borderRadius: '12px', background: '#1e293b', color: '#fff', fontSize: '14px' }
        }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
