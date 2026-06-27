import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import { Navigate, useParams } from 'react-router-dom';
import { DEFAULT_YEAR } from './YearContext';

const PublicRoute = ({ children }) => {
  const { isLoggedIn, primaryRole } = useContext(AuthContext);
  const { year } = useParams();
  const activeYear = year || DEFAULT_YEAR;

  if (!isLoggedIn) return children;

  const role = primaryRole();
  switch (role) {
    case 'Admin':
    case 'Class Teacher':
    case 'Subject Teacher': return <Navigate to={`/${activeYear}/teacher`} replace />;
    case 'Student':         return <Navigate to={`/${activeYear}/student`} replace />;
    default:                return children;
  }
};

export default PublicRoute;
