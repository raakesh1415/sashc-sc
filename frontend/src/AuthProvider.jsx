import { useState, useEffect, createContext, useCallback } from 'react';
import { ROLE_PRIORITY } from './constants';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRoles, setUserRoles] = useState([]);   // array of roles
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedRoles = localStorage.getItem('userRoles');
    setIsLoggedIn(!!token);
    try {
      setUserRoles(storedRoles ? JSON.parse(storedRoles) : []);
    } catch {
      setUserRoles([]);
    }
    setLoading(false);
  }, []);

  /** Convenience: does the user have a specific role? */
  const hasRole = useCallback((role) => userRoles.includes(role), [userRoles]);

  /** Primary role for redirect decisions (highest priority wins) */
  const primaryRole = useCallback(
    () => ROLE_PRIORITY.find((r) => userRoles.includes(r)) || null,
    [userRoles]
  );

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, setIsLoggedIn, userRoles, setUserRoles, hasRole, primaryRole, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
export { AuthContext };