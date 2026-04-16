import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import ReviewsPage from './pages/ReviewsPage';
import CompetenciesPage from './pages/CompetenciesPage';
import DevelopmentPage from './pages/DevelopmentPage';
import TrainingPage from './pages/TrainingPage';
import GoalsPage from './pages/GoalsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — any authenticated user */}
      <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="/employees" element={<AuthGuard><EmployeesPage /></AuthGuard>} />
      <Route path="/employees/:id" element={<AuthGuard><EmployeeDetailPage /></AuthGuard>} />
      <Route path="/reviews" element={<AuthGuard><ReviewsPage /></AuthGuard>} />
      <Route path="/competencies" element={<AuthGuard><CompetenciesPage /></AuthGuard>} />
      <Route path="/development" element={<AuthGuard><DevelopmentPage /></AuthGuard>} />
      <Route path="/training" element={<AuthGuard><TrainingPage /></AuthGuard>} />
      <Route path="/goals" element={<AuthGuard><GoalsPage /></AuthGuard>} />

      {/* Admin only */}
      <Route path="/admin" element={<AuthGuard roles={['admin']}><AdminPage /></AuthGuard>} />

      {/* Profile */}
      <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
