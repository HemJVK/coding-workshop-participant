import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid, LinearProgress,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Slider, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { goalService } from '../services/goalService';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';

const STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'];
const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_COLORS = { high: 'error', medium: 'warning', low: 'default' };
const STATUS_COLORS = { completed: 'success', in_progress: 'info', not_started: 'default', on_hold: 'warning' };
const EMPTY = { employee_id: '', title: '', description: '', status: 'not_started', due_date: '', progress: 0, priority: 'medium' };

export default function GoalsPage() {
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);

  const [goals, setGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formErr, setFormErr] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [progressGoal, setProgressGoal] = useState(null);
  const [progressVal, setProgressVal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const [g, e] = await Promise.all([goalService.list(params), employeeService.list({ status: 'active' })]);
      setGoals(g.data);
      setEmployees(e.data);
    } catch { setSnack({ open: true, msg: 'Failed to load', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const openForm = (goal = null) => {
    setEditGoal(goal);
    setForm(goal ? {
      employee_id: goal.employee_id, title: goal.title, description: goal.description || '',
      status: goal.status, due_date: goal.due_date?.split('T')[0] || '', progress: goal.progress, priority: goal.priority,
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
      if (editGoal) { await goalService.update(editGoal.id, form); setSnack({ open: true, msg: 'Goal updated', sev: 'success' }); }
      else { await goalService.create(form); setSnack({ open: true, msg: 'Goal created', sev: 'success' }); }
      setFormOpen(false); load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Failed', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await goalService.delete(deleteId); setSnack({ open: true, msg: 'Goal deleted', sev: 'success' }); load(); }
    catch { setSnack({ open: true, msg: 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  const handleProgressSave = async () => {
    try { await goalService.updateProgress(progressGoal.id, progressVal); setSnack({ open: true, msg: 'Progress updated', sev: 'success' }); setProgressGoal(null); load(); }
    catch { setSnack({ open: true, msg: 'Update failed', sev: 'error' }); }
  };

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || `#${id}`;
  const completedCount = goals.filter(g => g.status === 'completed').length;
  const inProgressCount = goals.filter(g => g.status === 'in_progress').length;

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Goals & Career Objectives</Typography>
            <Typography variant="body2" color="text.secondary">
              {goals.length} total · {completedCount} completed · {inProgressCount} in progress
            </Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter Status</InputLabel>
              <Select label="Filter Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
              </Select>
            </FormControl>
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>New Goal</Button>}
          </Box>
        </Box>

        {loading ? <LoadingSpinner minHeight="40vh" /> : (
          <Grid container spacing={3}>
            {goals.map(g => (
              <Grid item xs={12} md={6} lg={4} key={g.id}>
                <Card sx={{ height: '100%', transition: '0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 5 } }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Box flex={1}>
                        <Box display="flex" gap={0.5} mb={0.5} flexWrap="wrap">
                          <Chip label={g.priority} size="small" color={PRIORITY_COLORS[g.priority]} sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                          <Chip label={g.status.replace('_', ' ')} size="small" color={STATUS_COLORS[g.status]} sx={{ textTransform: 'capitalize' }} />
                        </Box>
                        <Typography fontWeight={700}>{g.title}</Typography>
                        <Typography variant="caption" color="primary" fontWeight={500}>{getEmpName(g.employee_id)}</Typography>
                      </Box>
                      {canWrite && (
                        <Box display="flex" sx={{ ml: 1 }}>
                          <IconButton size="small" onClick={() => openForm(g)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => { setDeleteId(g.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton>
                        </Box>
                      )}
                    </Box>
                    {g.description && <Typography variant="body2" color="text.secondary" mb={2} sx={{ flex: 1 }}>{g.description}</Typography>}
                    <Box mt="auto">
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">Progress</Typography>
                        <Typography variant="caption" fontWeight={700}>{g.progress}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={g.progress}
                        sx={{ height: 8, borderRadius: 4, cursor: canWrite ? 'pointer' : 'default',
                          bgcolor: '#E2E8F0',
                          '& .MuiLinearProgress-bar': { bgcolor: g.progress === 100 ? '#2E7D32' : '#1565C0' } }}
                        onClick={() => { if (canWrite) { setProgressGoal(g); setProgressVal(g.progress); } }}
                      />
                      {g.due_date && (
                        <Typography variant="caption" color="text.muted" display="block" mt={0.5}>
                          Due: {new Date(g.due_date).toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {!goals.length && (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <FlagIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">No goals found.</Typography>
                  {canWrite && <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => openForm()}>Create First Goal</Button>}
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </Box>

      {/* Progress Dialog */}
      <Dialog open={!!progressGoal} onClose={() => setProgressGoal(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Update Progress</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={3}>{progressGoal?.title}</Typography>
          <Typography variant="body2" fontWeight={600} mb={1}>Progress: {progressVal}%</Typography>
          <Slider value={progressVal} onChange={(_, v) => setProgressVal(v)} min={0} max={100} step={5}
            marks valueLabelDisplay="auto" color="primary" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setProgressGoal(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleProgressSave} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editGoal ? 'Edit Goal' : 'New Goal'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small" error={!!formErr.employee_id}>
                <InputLabel>Employee *</InputLabel>
                <Select label="Employee *" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                  {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Goal Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} error={!!formErr.title} helperText={formErr.title} size="small" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map(p => <MenuItem key={p} value={p} sx={{ textTransform: 'capitalize' }}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained">{editGoal ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete Goal" message="This will permanently delete this goal." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
