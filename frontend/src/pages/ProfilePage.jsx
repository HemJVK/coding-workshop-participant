import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Divider,
  Chip, Button, TextField, Alert, Stack, Paper
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SecurityIcon from '@mui/icons-material/Security';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { authService } from '../services/authService';

const ROLE_COLORS = {
  admin: '#C62828',
  manager: '#E65100',
  hr: '#9C27B0',
  employee: '#1565C0',
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authService.getMe();
        setUser(response.data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError('Could not load profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <Box className="fade-in" sx={{ maxWidth: 800, mx: 'auto', mt: 2 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>My Profile</Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Manage your personal information and account settings.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Card sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 3 }}>
          <Box sx={{ height: 120, bgcolor: '#1565C0', position: 'relative' }}>
            <Avatar 
              sx={{ 
                width: 100, height: 100, border: '4px solid white',
                position: 'absolute', bottom: -50, left: 32,
                bgcolor: 'white', color: '#1565C0', fontSize: 40, fontWeight: 800,
                boxShadow: 2
              }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </Box>
          <CardContent sx={{ pt: 8, px: 4, pb: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
              <Box>
                <Typography variant="h5" fontWeight={700}>{user?.name}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                  <Chip 
                    label={user?.role} 
                    size="small" 
                    sx={{ 
                      fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                      bgcolor: `${ROLE_COLORS[user?.role]}20`,
                      color: ROLE_COLORS[user?.role]
                    }} 
                  />
                  <Typography variant="body2" color="text.secondary">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Stack>
              </Box>
              <Button variant="outlined" size="small" disabled>Edit Profile</Button>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.disabled" fontWeight={700}>Basic Information</Typography>
                <Stack spacing={2.5} mt={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <PersonIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block">Full Name</Typography>
                      <Typography variant="body2" fontWeight={600}>{user?.name}</Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <EmailIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block">Email Address</Typography>
                      <Typography variant="body2" fontWeight={600}>{user?.email}</Typography>
                    </Box>
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.disabled" fontWeight={700}>Work Details</Typography>
                <Stack spacing={2.5} mt={2}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <BusinessIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block">Department</Typography>
                      <Typography variant="body2" fontWeight={600}>{user?.department || 'Not Assigned'}</Typography>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center" gap={2}>
                    <SecurityIcon color="action" />
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block">User Role</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {user?.role} Access
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Paper sx={{ p: 3, mt: 4, borderRadius: 3, bgcolor: '#f8f9fa', border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Account Security</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Your account is secured with role-based access control. Contact your administrator if you need to change your permissions.
          </Typography>
          <Button variant="text" size="small" sx={{ fontWeight: 700 }}>Change Password</Button>
        </Paper>
      </Box>
    </Layout>
  );
}
