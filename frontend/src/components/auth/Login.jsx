import { useState, useContext } from 'react';
import AxiosInstance from '../../AxiosInstance';
import { ROLE_PRIORITY, toFullEmail } from '../../constants';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../AuthProvider';
import {
  Box, Card, TextField, Button, Typography,
  InputAdornment, CircularProgress, Link, IconButton,
  Select, MenuItem,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import MyMessage from '../layout/Message';

import sasLogoImage from '../../assets/images/sas-logo.png';
import loginImage from '../../assets/images/login.jpg';

const START_YEAR = 2024;
const buildYears = () => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= START_YEAR; y--) years.push(y);
  return years.slice(0, 3);
};
const YEARS = buildYears();

const getRedirectPath = (roles, year) => {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      switch (role) {
        case 'Admin':
        case 'Class Teacher':
        case 'Subject Teacher': return `/${year}/teacher`;
        case 'Student':         return `/${year}/student`;
      }
    }
  }
  return `/${year}/login`;
};

const Login = () => {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [msgKey, setMsgKey]             = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const navigate                        = useNavigate();
  const { year }                        = useParams();
  const { setIsLoggedIn, setUserRoles } = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    const fullEmail = toFullEmail(email);
    setLoading(true);
    setError(null);
    localStorage.setItem('activeYear', year); // ensure interceptor sends ?year= before tokens exist

    try {
      const loginData = { email: fullEmail, password };

      // 1. Get JWT tokens — include year so the backend finds the right account
      const tokenRes = await AxiosInstance.post(`/token/`, loginData);
      localStorage.setItem('accessToken', tokenRes.data.access);
      localStorage.setItem('refreshToken', tokenRes.data.refresh);

      // 2. Get user info + roles
      const res = await AxiosInstance.post(`/login/`, loginData);
      const roles = res.data.role || [];

      localStorage.setItem('userEmail', fullEmail);
      localStorage.setItem('userRoles', JSON.stringify(roles));
      localStorage.setItem('activeYear', year);   // persist year for Axios interceptor
      setIsLoggedIn(true);
      setUserRoles(roles);

      navigate(getRedirectPath(roles, year));
    } catch {
      setError('E-mel atau kata laluan tidak sah.');
      setMsgKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #00ffef, #40e0d0)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 1000,
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          borderRadius: 4,
        }}
      >
        {/* Left image */}
        <Box
          sx={{
            flex: 1,
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            backgroundColor: '#fff',
          }}
        >
          <img src={loginImage} alt="Login Illustration" style={{ width: '100%', objectFit: 'cover' }} />
        </Box>

        {/* Right form */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 4, sm: 6 },
            bgcolor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <img src={sasLogoImage} alt="SAS Logo" style={{ height: 90, marginBottom: 12 }} />
            <Typography variant="subtitle1" fontWeight="bold">
              SEKOLAH MENENGAH ST. ANTHONY WP LABUAN
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: 2, mt: 4, mb: 1 }}>SASHC</Typography>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Sesi</Typography>
              <Select
                value={parseInt(year)}
                onChange={(e) => navigate(`/${e.target.value}/login`)}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: 13,
                  height: 28,
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.2)' },
                  '.MuiSelect-select': { py: '2px', px: '8px' },
                }}
              >
                {YEARS.map((y) => (
                  <MenuItem key={y} value={y} sx={{ fontSize: 13 }}>{y}</MenuItem>
                ))}
              </Select>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Hanya untuk pengguna yang berdaftar sahaja
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Emel"
              placeholder="Masukkan emel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 3 }}
              slotProps={{ input: {
                endAdornment: !email.includes('@') ? (
                  <InputAdornment position="end">
                    <Typography variant="body2" color="text.secondary">@moe-dl.edu.my</Typography>
                  </InputAdornment>
                ) : null,
              }}}
            />

            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Kata Laluan"
              placeholder="Masukkan kata laluan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 1 }}
              slotProps={{ input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label={showPassword ? 'Sembunyikan kata laluan' : 'Tunjukkan kata laluan'}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}}
            />

            <Box sx={{ textAlign: 'right', mb: 4 }}>
              <Link
                component="button"
                type="button"
                onClick={() => navigate(`/${year}/reset-password`)}
                sx={{ fontSize: '14px', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Lupa kata laluan?
              </Link>
            </Box>

            {error && <MyMessage key={msgKey} messageText={error} messagecolor="red" />}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, fontWeight: 600, color: '#000', bgcolor: '#00ffef', '&:hover': { bgcolor: '#00e6d8' } }}
            >
              {loading ? <><CircularProgress size={20} sx={{ mr: 1 }} />Log masuk...</> : 'Log Masuk'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Link
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                onClick={() => navigate('/')}
                sx={{ color: '#000' }}
              >
                Kembali ke laman utama
              </Link>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default Login;
