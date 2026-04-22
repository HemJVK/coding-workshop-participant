import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert, CircularProgress, Divider,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import { authService } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', captcha_text: '' });
  const [captchaData, setCaptchaData] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCaptcha = async () => {
    try {
      const { data } = await authService.getCaptcha();
      setCaptchaData(data);
    } catch (err) {
      console.error('Failed to load captcha', err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.captcha_text) { setError('Email, password, and captcha are required'); return; }
    setLoading(true); setError('');
    try {
      const loginData = { ...form, captcha_hash: captchaData?.captcha_hash };
      const { data } = await authService.login(loginData);
      authService.saveSession(data.token, data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      fetchCaptcha(); // Refresh captcha on failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 40%, #00838F 100%)',
      p: 2,
    }}>
      <Card sx={{ width: '100%', maxWidth: 420, borderRadius: 3, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #1565C0, #1976D2)', px: 4, py: 3, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 40, color: 'white', mb: 1 }} />
          <Typography variant="h5" fontWeight={800} color="white">ACME Inc.</Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.8)">Performance & Development Platform</Typography>
        </Box>

        <CardContent sx={{ px: 4, py: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Sign In</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Welcome back! Enter your credentials to continue.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth name="email" label="Email Address" type="email" autoComplete="email"
              value={form.email} onChange={handleChange} required sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon color="action" fontSize="small" /></InputAdornment> }}
            />
            <TextField
              fullWidth name="password" label="Password" type={showPass ? 'text' : 'password'}
              autoComplete="current-password" value={form.password} onChange={handleChange} required sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon color="action" fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(!showPass)} size="small">
                      {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {captchaData && (
              <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={captchaData.captcha_image} alt="CAPTCHA" style={{ marginBottom: '10px' }} />
                <TextField
                  fullWidth name="captcha_text" label="Enter CAPTCHA"
                  value={form.captcha_text} onChange={handleChange} required
                />
                <Button size="small" onClick={fetchCaptcha}>Reload CAPTCHA</Button>
              </Box>
            )}

            <Button fullWidth variant="contained" size="large" type="submit" disabled={loading}
              sx={{ py: 1.5, fontWeight: 700, fontSize: 16 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">Default credentials</Typography>
          </Divider>
          <Box sx={{ bgcolor: '#F0F4F8', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              admin@acme.com / Admin@1234
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
