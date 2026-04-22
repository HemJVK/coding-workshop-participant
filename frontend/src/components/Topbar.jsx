import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, IconButton, Avatar, Menu, MenuItem,
  Box, Tooltip, Divider, ListItemIcon,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { authService } from '../services/authService';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/employees': 'Employees',
  '/reviews': 'Performance Reviews',
  '/competencies': 'Competencies',
  '/development': 'Development Plans',
  '/training': 'Training Records',
  '/goals': 'Goals',
  '/admin': 'Admin Panel',
};

export default function Topbar({ onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getUser();
  const [anchorEl, setAnchorEl] = useState(null);

  const title = Object.entries(PAGE_TITLES).find(([path]) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  })?.[1] || 'ACME Platform';

  const handleLogout = () => {
    authService.clearSession();
    navigate('/login');
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{
      bgcolor: 'white', borderBottom: '1px solid', borderColor: 'divider',
      color: 'text.primary',
    }}>
      <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 2, display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" fontWeight={700} sx={{ flex: 1, color: 'text.primary' }}>
          {title}
        </Typography>

        {user && (
          <>
            <Tooltip title="Account">
              <Box
                display="flex" alignItems="center" gap={1} sx={{ cursor: 'pointer', borderRadius: 2, px: 1.5, py: 0.5,
                  '&:hover': { bgcolor: 'action.hover' }, transition: '0.15s' }}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                <Avatar sx={{ width: 34, height: 34, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                  {user.name?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{user.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{user.role}</Typography>
                </Box>
                <KeyboardArrowDownIcon fontSize="small" color="action" />
              </Box>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{ sx: { mt: 1, minWidth: 180, borderRadius: 2, boxShadow: 4 } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                My Profile
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                Sign Out
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
