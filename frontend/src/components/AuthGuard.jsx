import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function AuthGuard({ children, roles }) {
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />;
  if (roles) {
    const user = authService.getUser();
    if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  }
  return children;
}
