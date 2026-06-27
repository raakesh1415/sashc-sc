import { useState, useContext, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../AuthProvider';
import { useYear } from '../../YearContext';
import AxiosInstance from '../../AxiosInstance';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography,
  ListItemButton, ListItemIcon, ListItemText,
  IconButton, Avatar, Menu, MenuItem, Divider, Collapse, useTheme, Badge, Tooltip,
} from '@mui/material';
import {
  Dashboard, People, School, MenuBook, Assignment, Grade, Description, EmojiEvents,
  ExpandLess, ExpandMore, Leaderboard, Person,
  Menu as MenuIcon, MenuOpen, PieChart, BarChart, Analytics, MenuBook as SubjectIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';

import sasLogoImage from '../../assets/images/sas-logo.png';
import { ROLE_ORDER } from '../../constants';

const drawerWidth     = 265;
const miniDrawerWidth = 70;

// ─── Menu config per role ─────────────────────────────────────────────────────
// Paths are relative (no year prefix). Navbar prepends /:year at render time.

const MENU_CONFIG = {
  Admin: [
    { label: 'Laman Utama', icon: <Dashboard />, path: '/teacher' },
    {
      label: 'Pengurusan',
      icon: <People />,
      children: [
        { label: 'Kelas',          path: '/classes',  icon: <School /> },
        { label: 'Mata Pelajaran', path: '/subjects', icon: <MenuBook /> },
        { label: 'Pengguna',       path: '/users',    icon: <People /> },
      ],
    },
    {
      label: 'Penilaian',
      icon: <Assignment />,
      children: [
        { label: 'Peperiksaan TOV', path: '/tov', icon: <Assignment /> },
      ],
    },
    {
      label: 'Analisis',
      icon: <Analytics />,
      children: [
        { label: 'Headcount Pelajar',    path: '/headcount',        icon: <PieChart /> },
        { label: 'Analisis Peperiksaan', path: '/analysis-exam', icon: <BarChart /> },
        { label: 'Analisis Pelajar',     path: '/analysis-student', icon: <Person /> },
      ],
    },
    {
      label: 'Kedudukan',
      icon: <Leaderboard />,
      children: [
        { label: 'Kedudukan Keseluruhan',    path: '/ranking-overall', icon: <EmojiEvents /> },
        { label: 'Kedudukan Mata Pelajaran', path: '/ranking-subject', icon: <SubjectIcon /> },
      ],
    },
    { label: 'Slip Headcount', path: '/headcount-slip', icon: <Description /> },
  ],
  'Subject Teacher': [
    { label: 'Laman Utama', icon: <Dashboard />, path: '/teacher' },
    {
      label: 'Penilaian',
      icon: <Assignment />,
      children: [
        { label: 'Peperiksaan AR1', path: '/ar1', icon: <Assignment /> },
        { label: 'Peperiksaan AR2', path: '/ar2', icon: <Assignment /> },
        { label: 'Peperiksaan ETR', path: '/etr', icon: <Assignment /> },
      ],
    },
    {
      label: 'Analisis',
      icon: <Analytics />,
      children: [
        { label: 'Headcount Pelajar',    path: '/headcount',        icon: <PieChart /> },
        { label: 'Analisis Peperiksaan', path: '/analysis-exam', icon: <EmojiEvents /> },
      ],
    },
    {
      label: 'Kedudukan',
      icon: <Leaderboard />,
      children: [
        { label: 'Kedudukan Mata Pelajaran', path: '/ranking-subject', icon: <SubjectIcon /> },
      ],
    },
  ],
  'Class Teacher': [
    { label: 'Laman Utama', icon: <Dashboard />, path: '/teacher' },
    {
      label: 'Analisis',
      icon: <Analytics />,
      children: [
        { label: 'Analisis Pelajar', path: '/analysis-student', icon: <Person /> },
      ],
    },
    {
      label: 'Kedudukan',
      icon: <Leaderboard />,
      children: [
        { label: 'Kedudukan Keseluruhan',    path: '/ranking-overall', icon: <EmojiEvents /> },
      ],
    },
    { label: 'Slip Headcount', path: '/headcount-slip', icon: <Description /> },
  ],
  Student: [
    { label: 'Laman Utama', icon: <Dashboard />, path: '/student' },
    {
      label: 'Analisis',
      icon: <Analytics />,
      children: [
        { label: 'Analisis Pelajar', path: '/analysis-self', icon: <Person /> },
      ],
    },
    {
      label: 'Kedudukan',
      icon: <Leaderboard />,
      children: [
        { label: 'Kedudukan Keseluruhan',    path: '/ranking-overall',  icon: <EmojiEvents /> },
        { label: 'Kedudukan Mata Pelajaran', path: '/ranking-subject',  icon: <SubjectIcon /> },
      ],
    },
    { label: 'Slip Headcount', path: '/student-headcount-slip', icon: <Description /> },
  ],
};

const ROLE_LABELS_BM = {
  'Admin': 'Pentadbir',
  'Subject Teacher': 'Guru Mata Pelajaran',
  'Class Teacher': 'Guru Kelas',
  'Student': 'Pelajar',
};

function buildMergedMenu(roles) {
  const menuOrder = ['Laman Utama', 'Pengurusan', 'Peperiksaan', 'Penilaian', 'Analisis', 'Kedudukan', 'Slip Headcount'];
  const merged = [];
  const groupMap = {};

  for (const role of roles) {
    for (const item of (MENU_CONFIG[role] || [])) {
      if (item.children) {
        if (groupMap[item.label] !== undefined) {
          const existing = merged[groupMap[item.label]];
          const existingPaths = new Set(existing.children.map((c) => c.path));
          for (const child of item.children) {
            if (!existingPaths.has(child.path)) {
              existing.children.push(child);
              existingPaths.add(child.path);
            }
          }
        } else {
          groupMap[item.label] = merged.length;
          merged.push({ ...item, children: [...item.children] });
        }
      } else {
        if (!merged.find((m) => m.path === item.path)) merged.push(item);
      }
    }
  }

  merged.sort((a, b) => {
    const ia = menuOrder.indexOf(a.label);
    const ib = menuOrder.indexOf(b.label);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return 0;
  });

  return merged;
}

// Returns true when `current` matches `yearPath` exactly OR is a sub-route of it
const isPathActive = (current, yearPath) =>
  current === yearPath || current.startsWith(yearPath + '/');

const btnSx = (isActive, isExpanded, indent = false, activeBg, activeText, hoverBg) => ({
  px: 2,
  pl: indent && isExpanded ? 4 : 2,
  mb: 0.5,
  borderRadius: 1,
  justifyContent: isExpanded ? 'flex-start' : 'center',
  bgcolor: isActive ? activeBg : 'transparent',
  color:   isActive ? activeText : 'text.primary',
  '& .MuiListItemIcon-root': { color: isActive ? activeText : 'inherit' },
  '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
  '&.Mui-selected': {
    bgcolor: isActive ? activeBg : 'transparent',
    color:   isActive ? activeText : 'text.primary',
    '& .MuiListItemIcon-root': { color: isActive ? activeText : 'inherit' },
    '&:hover': { bgcolor: isActive ? activeBg : hoverBg },
  },
});

// ─── Navbar ───────────────────────────────────────────────────────────────────

const Navbar = ({ children }) => {
  const theme = useTheme();
  const { activeBg, activeText, hoverBg } = theme.palette.navbar;
  const { userRoles, setIsLoggedIn } = useContext(AuthContext);
  const year     = useYear();
  const location = useLocation();
  const navigate = useNavigate();

  const [profileAnchor, setProfileAnchor] = useState(null);
  const [isExpanded, setIsExpanded]       = useState(true);
  const [openMenus, setOpenMenus]         = useState({});
  const [userData, setUserData]           = useState(null);
  const [unreadCount, setUnreadCount]     = useState(0);

  const isAdmin = userRoles.includes('Admin');

  const menuItems = useMemo(() => buildMergedMenu(userRoles), [userRoles]);
  const sortedRoles = [...userRoles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  const roleLabel = sortedRoles.length > 1
    ? sortedRoles.map((r) => ROLE_LABELS_BM[r] || r).join(' · ')
    : (ROLE_LABELS_BM[sortedRoles[0]] || sortedRoles[0] || 'Pengguna');

  const toggleDrawer     = () => setIsExpanded((p) => !p);
  const handleMenuToggle = (key) => setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  const handleLogout     = () => { localStorage.clear(); setIsLoggedIn(false); navigate(`/${year}/login`); };
  const handleProfileClick = () => { setProfileAnchor(null); navigate(`/${year}/profile`); };

  // Prepend year to a relative menu path
  const yp = (path) => `/${year}${path}`;

  const fetchUnreadCount = async () => {
    if (!isAdmin) return;
    try {
      const res = await AxiosInstance.get('/feedback/unread-count/');
      setUnreadCount(res.data.count || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const controller = new AbortController();

    const fetchUserProfile = async () => {
      try {
        const res = await AxiosInstance.get('/users/profile/', { signal: controller.signal });
        const data = res.data.data || res.data;
        setUserData({ name: data.name || '', profilePicture: data.profilePicture || null });
      } catch (err) {
        if (err.name !== 'CanceledError') {
          // silently ignore — profile avatar is non-critical
        }
      }
    };

    fetchUserProfile();
    fetchUnreadCount();

    window.addEventListener('profileUpdated', fetchUserProfile);
    window.addEventListener('feedbackUpdated', fetchUnreadCount);
    return () => {
      controller.abort();
      window.removeEventListener('profileUpdated', fetchUserProfile);
      window.removeEventListener('feedbackUpdated', fetchUnreadCount);
    };
  }, [isAdmin]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter((p) => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Box sx={{ display: 'flex' }}>

      {/* ── AppBar ── */}
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: 'background.paper', color: 'text.primary', boxShadow: 1 }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={toggleDrawer} sx={{ ml: -1, mr: 1, color: 'text.primary' }}>
              {isExpanded ? <MenuOpen /> : <MenuIcon />}
            </IconButton>
            <img src={sasLogoImage} alt="Logo" width={36} />
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: 2 }}>SASHC</Typography>
            <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontWeight: 600 }}>
              {year}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isAdmin && (
              <Tooltip title="Maklum Balas">
                <IconButton onClick={() => navigate(yp('/feedback'))}>
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    <NotificationsIcon sx={{ color: unreadCount > 0 ? 'btn.primary.hover' : 'text.secondary' }} />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={(e) => setProfileAnchor(e.currentTarget)}>
              <Avatar
                src={userData?.profilePicture || undefined}
                sx={{ bgcolor: activeBg, color: 'text.primary', fontWeight: 600, fontSize: '1rem', width: 40, height: 40 }}
              >
                {!userData?.profilePicture && getInitials(userData?.name || '')}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={profileAnchor}
              open={Boolean(profileAnchor)}
              onClose={() => setProfileAnchor(null)}
              slotProps={{ paper: { sx: { minWidth: 220, px: 1 } } }}
            >
              <MenuItem disabled>
                <Typography variant="body2" fontWeight={600}>{roleLabel}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleProfileClick}>Profil</MenuItem>
              {/* <MenuItem>Tetapan</MenuItem> */}
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>Log Keluar</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Drawer ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: isExpanded ? drawerWidth : miniDrawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isExpanded ? drawerWidth : miniDrawerWidth,
            transition: 'width 0.3s',
            overflowX: 'hidden',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Toolbar />
        <List sx={{ px: 1, pt: 1 }}>
          {menuItems.map((item, index) => {
            const itemYearPath = yp(item.path || '');
            const isActive     = isPathActive(location.pathname, itemYearPath);

            /* ── Group item (has children) ── */
            if (item.children) {
              const open = !!openMenus[item.label];
              return (
                <Box key={index}>
                  <ListItemButton
                    onClick={() => handleMenuToggle(item.label)}
                    sx={btnSx(false, isExpanded, false, activeBg, activeText, hoverBg)}
                  >
                    <ListItemIcon sx={{ minWidth: 0, mr: isExpanded ? 2 : 0, justifyContent: 'center' }}>
                      {item.icon}
                    </ListItemIcon>
                    {isExpanded && <ListItemText primary={item.label} />}
                    {isExpanded && (open ? <ExpandLess /> : <ExpandMore />)}
                  </ListItemButton>

                  <Collapse in={open} timeout="auto" unmountOnExit>
                    {item.children.map((child, i) => {
                      const childYearPath = yp(child.path);
                      const childActive   = isPathActive(location.pathname, childYearPath);
                      return (
                        <ListItemButton
                          key={i}
                          component={Link}
                          to={childYearPath}
                          sx={btnSx(childActive, isExpanded, true, activeBg, activeText, hoverBg)}
                        >
                          <ListItemIcon sx={{ minWidth: 0, mr: isExpanded ? 2 : 0, justifyContent: 'center' }}>
                            {child.icon}
                          </ListItemIcon>
                          {isExpanded && <ListItemText primary={child.label} />}
                        </ListItemButton>
                      );
                    })}
                  </Collapse>
                </Box>
              );
            }

            /* ── Top-level link ── */
            return (
              <ListItemButton
                key={index}
                component={Link}
                to={itemYearPath}
                sx={btnSx(isActive, isExpanded, false, activeBg, activeText, hoverBg)}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: isExpanded ? 2 : 0, justifyContent: 'center' }}>
                  {item.icon}
                </ListItemIcon>
                {isExpanded && <ListItemText primary={item.label} />}
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      {/* ── Main content ── */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh', bgcolor: '#f5f7fa' }}>
        <Toolbar />
        {children}
      </Box>

    </Box>
  );
};

export default Navbar;
