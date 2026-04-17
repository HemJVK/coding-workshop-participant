import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { developmentService } from '../services/developmentService';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';

const STATUSES = ['active', 'completed', 'on_hold'];
const EMPTY = { employee_id: '', title: '', objectives: '', actions: '', resources: '', status: 'active', start_date: '', end_date: '' };

export default function DevelopmentPage() {
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'hr'].includes(user?.role);

  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formErr, setFormErr] = useState({});
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const [p, e] = await Promise.all([developmentService.list(params), employeeService.list({ status: 'active' })]);
      setPlans(p.data);
      setEmployees(e.data);
    } catch { setSnack({ open: true, msg: 'Failed to load', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const openForm = (plan = null) => {
    setEditPlan(plan);
    setForm(plan ? {
      employee_id: plan.employee_id, title: plan.title, objectives: plan.objectives || '',
      actions: plan.actions || '', resources: plan.resources || '', status: plan.status,
      start_date: plan.start_date?.split('T')[0] || '', end_date: plan.end_date?.split('T')[0] || '',
    } : { ...EMPTY });
    setFormErr({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.employee_id) errs.employee_id = 'Select employee';
    if (!form.title.trim()) errs.title = 'Title required';
    setFormErr(errs);
    return !Object.keys(errs).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editPlan) { await developmentService.update(editPlan.id, form); setSnack({ open: true, msg: 'Plan updated', sev: 'success' }); }
      else { await developmentService.create(form); setSnack({ open: true, msg: 'Plan created', sev: 'success' }); }
      setFormOpen(false); load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Failed', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await developmentService.delete(deleteId); setSnack({ open: true, msg: 'Plan deleted', sev: 'success' }); load(); }
    catch { setSnack({ open: true, msg: 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || `#${id}`;
  const STATUS_COLORS = { active: 'success', completed: 'info', on_hold: 'warning' };

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Development Plans</Typography>
            <Typography variant="body2" color="text.secondary">{plans.length} plan(s)</Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>New Plan</Button>}
          </Box>
        </Box>

        {loading ? <LoadingSpinner minHeight="40vh" /> : (
          <Grid container spacing={3}>
            {plans.map(p => (
              <Grid item xs={12} md={6} key={p.id}>
                <Card sx={{ height: '100%', transition: '0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 5 } }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                      <Box flex={1}>
                        <Typography fontWeight={700} gutterBottom>{p.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getEmpName(p.employee_id)}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={0.5} alignItems="center">
                        <Chip label={p.status} size="small" color={STATUS_COLORS[p.status] || 'default'} sx={{ textTransform: 'capitalize' }} />
                        {canWrite && (
                          <>
                            <Tooltip title="Edit"><IconButton size="small" onClick={() => openForm(p)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { setDeleteId(p.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                          </>
                        )}
                      </Box>
                    </Box>
                    {p.objectives && (
                      <Box mb={1}>
                        <Typography variant="caption" fontWeight={700} color="primary">OBJECTIVES</Typography>
                        <Typography variant="body2" color="text.secondary">{p.objectives}</Typography>
                      </Box>
                    )}
                    {p.actions && (
                      <Box mb={1}>
                        <Typography variant="caption" fontWeight={700} color="secondary.main">ACTIONS</Typography>
                        <Typography variant="body2" color="text.secondary">{p.actions}</Typography>
                      </Box>
                    )}
                    {(p.start_date || p.end_date) && (
                      <Typography variant="caption" color="text.muted" display="block" mt={1}>
                        📅 {p.start_date ? new Date(p.start_date).toLocaleDateString() : '?'} → {p.end_date ? new Date(p.end_date).toLocaleDateString() : 'Ongoing'}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {!plans.length && (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography color="text.secondary">No development plans found.</Typography>
                  {canWrite && <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => openForm()}>Create First Plan</Button>}
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editPlan ? 'Edit Plan' : 'New Development Plan'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" error={!!formErr.employee_id}>
                <InputLabel>Employee *</InputLabel>
                <Select label="Employee *" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                  {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name} — {e.department}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Plan Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} error={!!formErr.title} helperText={formErr.title} size="small" />
            </Grid>
            {[{ name: 'objectives', label: 'Objectives', rows: 2 }, { name: 'actions', label: 'Key Actions', rows: 2 }, { name: 'resources', label: 'Resources Required', rows: 2 }].map(({ name, label, rows }) => (
              <Grid item xs={12} key={name}>
                <TextField fullWidth multiline rows={rows} label={label} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} size="small" />
              </Grid>
            ))}
            <Grid item xs={6}>
              <TextField fullWidth label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="End Date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained">{editPlan ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete Plan" message="This will permanently delete the development plan." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
