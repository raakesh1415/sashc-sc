import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import { Navigate, useParams } from 'react-router-dom';
import { DEFAULT_YEAR } from './YearContext';

const ROLE_HOME = {
  'Admin':           '/teacher',
  'Class Teacher':   '/teacher',
  'Subject Teacher': '/teacher',
  'Student':         '/student',
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isLoggedIn, userRoles, primaryRole } = useContext(AuthContext);
  const { year } = useParams();
  const activeYear = year || DEFAULT_YEAR;

  if (!isLoggedIn) return <Navigate to={`/${activeYear}/login`} />;

  if (allowedRoles && !allowedRoles.some((r) => userRoles.includes(r))) {
    const home = ROLE_HOME[primaryRole()] || '/login';
    return <Navigate to={`/${activeYear}${home}`} />;
  }

  return children;
};

export default ProtectedRoute;
