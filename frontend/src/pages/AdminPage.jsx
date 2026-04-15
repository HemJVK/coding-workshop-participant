import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Avatar, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
  InputLabel, Select, MenuItem, TextField, Grid, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { authService } from '../services/authService';

const ROLES = ['admin', 'manager', 'contributor', 'viewer'];
const ROLE_COLORS = { admin: 'error', manager: 'warning', contributor: 'info', viewer: 'success' };
const DEPARTMENTS = ['Engineering', 'Product', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations'];
const EMPTY_FORM = { name: '', email: '', password: '', role: 'viewer', department: '' };

export default function AdminPage() {
  const currentUser = authService.getUser();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await authService.listUsers();
      setUsers(data);
    } catch { setSnack({ open: true, msg: 'Failed to load users', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '' });
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setSnack({ open: true, msg: 'Name and email are required', sev: 'error' });
      return;
    }
    try {
      if (editUser) {
        const payload = { name: form.name, role: form.role, department: form.department };
        await authService.updateUser(editUser.id, payload);
        setSnack({ open: true, msg: 'User updated', sev: 'success' });
      } else {
        if (!form.password || form.password.length < 8) { setSnack({ open: true, msg: 'Password must be at least 8 characters', sev: 'error' }); return; }
        await authService.register({ name: form.name, email: form.email, password: form.password, role: form.role });
        setSnack({ open: true, msg: 'User created', sev: 'success' });
      }
      setFormOpen(false);
      load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Operation failed', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await authService.deleteUser(deleteId); setSnack({ open: true, msg: 'User deleted', sev: 'success' }); load(); }
    catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <AdminPanelSettingsIcon sx={{ color: 'error.main', fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight={800}>Admin Panel</Typography>
              <Typography variant="body2" color="text.secondary">{users.length} platform user(s)</Typography>
            </Box>
          </Box>
          <Button variant="contained" color="error" startIcon={<PersonAddIcon />} onClick={openCreate}>Add User</Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
          Manage platform users, assign roles, and control access. Only admins can access this page.
        </Alert>

        <Card>
          <CardContent sx={{ p: 0 }}>
            {loading ? <LoadingSpinner minHeight="30vh" /> : (
              <Paper elevation={0}>
                <Table>
                  <TableHead><TableRow>
                    <TableCell>User</TableCell><TableCell>Role</TableCell>
                    <TableCell>Department</TableCell><TableCell>Joined</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id} hover sx={{ bgcolor: u.id === currentUser?.id ? '#1565C008' : 'transparent' }}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1.5}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                              {u.name?.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{u.name} {u.id === currentUser?.id && <Chip label="You" size="small" sx={{ ml: 0.5, height: 16, fontSize: 10 }} />}</Typography>
                              <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={u.role} size="small" color={ROLE_COLORS[u.role] || 'default'} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                        </TableCell>
                        <TableCell>{u.department || '—'}</TableCell>
                        <TableCell>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit Role"><IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          {u.id !== currentUser?.id && (
                            <Tooltip title="Delete User"><IconButton size="small" color="error" onClick={() => { setDeleteId(u.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}><TextField fullWidth label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} size="small" /></Grid>
            {!editUser && <>
              <Grid item xs={12}><TextField fullWidth label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} size="small" /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} size="small" helperText="Min 8 characters" /></Grid>
            </>}
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Role</InputLabel>
                <Select label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map(r => <MenuItem key={r} value={r} sx={{ textTransform: 'capitalize' }}>{r}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <MenuItem value="">None</MenuItem>
                  {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="error">{editUser ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete User" message="This will permanently delete this user account. This action cannot be undone." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
