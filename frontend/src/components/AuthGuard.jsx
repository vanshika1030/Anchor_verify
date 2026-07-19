import { Navigate } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
