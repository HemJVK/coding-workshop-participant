import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Box, Typography, Divider, Avatar, Chip, Tooltip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { authService } from '../services/authService';

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Employees', path: '/employees', icon: <PeopleIcon /> },
  { label: 'Reviews', path: '/reviews', icon: <AssessmentIcon /> },
  { label: 'Competencies', path: '/competencies', icon: <StarHalfIcon /> },
  { label: 'Development', path: '/development', icon: <TrendingUpIcon /> },
  { label: 'Training', path: '/training', icon: <SchoolIcon /> },
  { label: 'Goals', path: '/goals', icon: <FlagIcon /> },
];

const ROLE_COLORS = {
  admin: '#C62828', manager: '#E65100', hr: '#9C27B0', employee: '#1565C0',
};

export default function Sidebar({ open, variant = 'permanent', onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getUser();

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: 3, py: 2.5, background: 'linear-gradient(135deg, #1565C0, #1976D2)' }}>
        <Typography variant="h6" fontWeight={800} color="white" letterSpacing={0.5}>
          ACME Inc.
        </Typography>
        <Typography variant="caption" color="rgba(255,255,255,0.75)">
          Performance Platform
        </Typography>
      </Box>

      {/* User Info */}
      {user && (
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: '#1565C0', fontSize: 15, fontWeight: 700 }}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" fontWeight={600} noWrap>{user.name}</Typography>
              <Chip
                label={user.role}
                size="small"
                sx={{
                  height: 18, fontSize: 10, fontWeight: 700,
                  bgcolor: `${ROLE_COLORS[user.role]}20`,
                  color: ROLE_COLORS[user.role],
                  textTransform: 'capitalize',
                }}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* Nav Items */}
      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {navItems.map(({ label, path, icon }) => {
          const active = location.pathname === path;
          return (
            <ListItem disablePadding key={path} sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(path); if (onClose) onClose(); }}
                selected={active}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.15s',
                  '&.Mui-selected': {
                    bgcolor: '#1565C020',
                    color: '#1565C0',
                    '& .MuiListItemIcon-root': { color: '#1565C0' },
                    '&:hover': { bgcolor: '#1565C030' },
                  },
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? '#1565C0' : 'text.secondary' }}>
                  {icon}
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14 }}
                />
                {active && (
                  <Box sx={{ width: 4, height: 24, borderRadius: 2, bgcolor: '#1565C0', ml: 1 }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}

        {user?.role === 'admin' && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => { navigate('/admin'); if (onClose) onClose(); }}
                selected={location.pathname === '/admin'}
                sx={{ borderRadius: 2, '&.Mui-selected': { bgcolor: '#C6282820', color: '#C62828', '& .MuiListItemIcon-root': { color: '#C62828' } } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}><AdminPanelSettingsIcon /></ListItemIcon>
                <ListItemText primary="Admin" primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.disabled">v1.0.0 · ACME Inc. © 2025</Typography>
      </Box>
    </Box>
  );

  if (variant === 'temporary') {
    return (
      <Drawer variant="temporary" open={open} onClose={onClose}
        sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}>
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer variant="permanent"
      sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}>
      {content}
    </Drawer>
  );
}
