import { useEffect, Component } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography, Button } from '@mui/material';
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useLocation } from 'react-router-dom';
import "./App.css";
import AuthProvider from './AuthProvider.jsx';
import PublicRoute from './PublicRoute.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import Navbar from './components/layout/Navbar.jsx';
import { YearContext, DEFAULT_YEAR } from './YearContext.jsx';

import HomePage from './components/auth/HomePage.jsx';
import Login from './components/auth/Login.jsx';
import ResetPassword from './components/auth/ResetPassword.jsx';
import ConfirmResetPassword from './components/auth/ConfirmResetPassword.jsx';
import Profile from './components/auth/Profile.jsx';

import TeacherDashboard from './components/dashboard/TeacherDashboard.jsx';
import StudentDashboard from './components/dashboard/StudentDashboard.jsx';

import SubjectList from './components/subject/SubjectList.jsx';
import ClassList from './components/class/ClassList.jsx';
import UserList from './components/user/UserList.jsx';
import AddUser from './components/user/AddUser.jsx';
import EditUser from './components/user/EditUser.jsx';
import ViewUser from './components/user/ViewUser.jsx';
import TOVList from './components/tov/TOVList.jsx';
import ETRList from './components/etr/ETRList.jsx';
import AR1List from './components/ar/AR1List.jsx';
import AR2List from './components/ar/AR2List.jsx';
import HeadcountList from './components/headcount/HeadcountList.jsx';
import ExamAnalysis from './components/analysis/ExamAnalysis.jsx';
import StudentAnalysis from './components/analysis/StudentAnalysis.jsx';
import StudentSelfAnalysis from './components/analysis/StudentSelfAnalysis.jsx';
import OverallRanking from './components/ranking/OverallRanking.jsx';
import SubjectRanking from './components/ranking/SubjectRanking.jsx';
import HeadcountSlipList from './components/headcountslip/HeadcountSlipList.jsx';
import ViewHeadcountSlip from './components/headcountslip/ViewHeadcountSlip.jsx';
import PrintHeadcountSlip from './components/headcountslip/PrintHeadcountSlip.jsx';
import StudentHeadcountSlip from './components/headcountslip/StudentHeadcountSlip.jsx';
import FeedbackInbox from './components/feedback/Feedback.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, p: 3 }}>
          <Typography variant="h5" fontWeight="bold">Ralat Tidak Dijangka</Typography>
          <Typography variant="body2" color="text.secondary">Sila muat semula halaman atau hubungi pentadbir sistem.</Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>Muat Semula</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

const theme = createTheme({
  palette: {
    primary: { main: '#000000', text: '#ffffff' },
    secondary: { main: '#00ffef', text: '#000000' },
    background: { default: '#f5f7fa', paper: '#ffffff' },
    // ── Navbar active/hover colours — edit here to restyle the sidebar ──
    navbar: {
      activeBg:   '#00ffef',
      activeText: '#000000',
      hoverBg:    '#9afff8',
    },
    // ── Button colours — edit here to restyle all buttons globally ──────────
    btn: {
      primary:  { main: '#00ffef', hover: '#00e6d8', text: '#000000', gradient: '#40e0d0' },
      edit:     { main: '#FFC107', hover: '#FFB300', text: '#000000' },
      delete:   { main: '#F44336', hover: '#d32f2f', text: '#ffffff' },
      view:     { main: '#00BCD4', hover: '#00ACC1', text: '#ffffff' },
      save:     { main: '#2196F3', hover: '#1976D2', text: '#ffffff' },
      cancel:   { main: '#757575', hover: '#455a64', text: '#ffffff' },
      back:     { main: '#6c757d', hover: '#5a6268', text: '#ffffff' },
      download: { main: '#000000', hover: '#333333', text: '#ffffff' },
    },
    // ── Table defaults — edit AppTable.jsx (layout/AppTable.jsx) ─────────
  },
  typography: {
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
});

// Helper: wrap a page in Navbar
const WithNav = ({ children }) => <Navbar>{children}</Navbar>;

// Redirect bare /confirm-reset-password?token=... → /:year/confirm-reset-password?token=...
const ConfirmResetRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/${DEFAULT_YEAR}/confirm-reset-password${location.search}`} replace />;
};

// ── Year-scoped routes ────────────────────────────────────────────────────────
// Reads :year from the URL, stores it in localStorage (for the Axios interceptor),
// and provides it via YearContext to every child component.
const YearRoutes = () => {
  const { year } = useParams();

  useEffect(() => {
    if (year) localStorage.setItem('activeYear', year);
  }, [year]);

  return (
    <YearContext.Provider value={year || DEFAULT_YEAR}>
      <Routes>
        {/* ── Public ── */}
        <Route path="login"                  element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="reset-password"         element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="confirm-reset-password" element={<PublicRoute><ConfirmResetPassword /></PublicRoute>} />
        <Route path="profile"                element={<ProtectedRoute allowedRoles={['Admin','Subject Teacher','Class Teacher','Student']}><WithNav><Profile /></WithNav></ProtectedRoute>} />
        <Route path="feedback"               element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><FeedbackInbox /></WithNav></ProtectedRoute>} />

        {/* ── Teacher (Admin / Class Teacher / Subject Teacher) ── */}
        <Route path="teacher"            element={<ProtectedRoute allowedRoles={['Admin','Class Teacher','Subject Teacher']}><WithNav><TeacherDashboard /></WithNav></ProtectedRoute>} />
        <Route path="subjects"           element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><SubjectList /></WithNav></ProtectedRoute>} />
        <Route path="classes"            element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><ClassList /></WithNav></ProtectedRoute>} />
        <Route path="users"              element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><UserList /></WithNav></ProtectedRoute>} />
        <Route path="users/add"          element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><AddUser /></WithNav></ProtectedRoute>} />
        <Route path="users/edit/:id"     element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><EditUser /></WithNav></ProtectedRoute>} />
        <Route path="users/view/:id"     element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><ViewUser /></WithNav></ProtectedRoute>} />
        <Route path="tov"                element={<ProtectedRoute allowedRoles={['Admin']}><WithNav><TOVList /></WithNav></ProtectedRoute>} />
        <Route path="headcount"          element={<ProtectedRoute allowedRoles={['Admin','Subject Teacher']}><WithNav><HeadcountList /></WithNav></ProtectedRoute>} />
        <Route path="analysis-exam"      element={<ProtectedRoute allowedRoles={['Admin','Subject Teacher']}><WithNav><ExamAnalysis /></WithNav></ProtectedRoute>} />
        <Route path="analysis-student"   element={<ProtectedRoute allowedRoles={['Admin','Class Teacher']}><WithNav><StudentAnalysis /></WithNav></ProtectedRoute>} />
        <Route path="ranking-overall"    element={<ProtectedRoute allowedRoles={['Admin','Class Teacher','Student']}><WithNav><OverallRanking /></WithNav></ProtectedRoute>} />
        <Route path="ranking-subject"    element={<ProtectedRoute allowedRoles={['Admin','Subject Teacher','Student']}><WithNav><SubjectRanking /></WithNav></ProtectedRoute>} />
        <Route path="headcount-slip"              element={<ProtectedRoute allowedRoles={['Admin','Class Teacher']}><WithNav><HeadcountSlipList /></WithNav></ProtectedRoute>} />
        <Route path="headcount-slip/view/:userID" element={<ProtectedRoute allowedRoles={['Admin','Class Teacher']}><WithNav><ViewHeadcountSlip /></WithNav></ProtectedRoute>} />
        <Route path="headcount-slip/print"        element={<ProtectedRoute allowedRoles={['Admin','Class Teacher']}><WithNav><PrintHeadcountSlip /></WithNav></ProtectedRoute>} />

        {/* ── Subject Teacher ── */}
        <Route path="etr"            element={<ProtectedRoute allowedRoles={['Subject Teacher']}><WithNav><ETRList /></WithNav></ProtectedRoute>} />
        <Route path="ar1"            element={<ProtectedRoute allowedRoles={['Subject Teacher']}><WithNav><AR1List /></WithNav></ProtectedRoute>} />
        <Route path="ar2"            element={<ProtectedRoute allowedRoles={['Subject Teacher']}><WithNav><AR2List /></WithNav></ProtectedRoute>} />


        {/* ── Student ── */}
        <Route path="student"            element={<ProtectedRoute allowedRoles={['Student']}><WithNav><StudentDashboard /></WithNav></ProtectedRoute>} />
        <Route path="analysis-self"      element={<ProtectedRoute allowedRoles={['Student']}><WithNav><StudentSelfAnalysis /></WithNav></ProtectedRoute>} />
        <Route path="student-headcount-slip"  element={<ProtectedRoute allowedRoles={['Student']}><WithNav><StudentHeadcountSlip /></WithNav></ProtectedRoute>} />

        {/* ── 404 ── */}
        <Route path="*" element={
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>404 - Halaman Tidak Dijumpai</h2>
            <p>Halaman yang anda cari tidak wujud.</p>
          </div>
        } />
      </Routes>
    </YearContext.Provider>
  );
};

function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Root → landing page */}
            <Route path="/" element={<HomePage />} />
            {/* Bare confirm-reset-password link from email (no year prefix) */}
            <Route path="/confirm-reset-password" element={<ConfirmResetRedirect />} />
            {/* All pages under /:year/ */}
            <Route path="/:year/*" element={<YearRoutes />} />
            {/* Catch-all */}
            <Route path="*" element={<Navigate to={`/${DEFAULT_YEAR}/login`} replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
