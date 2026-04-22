import { useState } from 'react';
import { Box } from '@mui/material';
import { useMediaQuery, useTheme } from '@mui/material';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const DRAWER_WIDTH = 260;

export default function Layout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar variant="permanent" />}

      {/* Mobile sidebar */}
      {isMobile && (
        <Sidebar
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}
          className="fade-in"
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
