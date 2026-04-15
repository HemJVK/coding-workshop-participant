import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, FormControl,
  InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { trainingService } from '../services/trainingService';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts';

const STATUSES = ['enrolled', 'in_progress', 'completed', 'cancelled'];
const TYPES = ['online', 'classroom', 'certification', 'workshop', 'coaching'];
const COLORS = { completed: '#2E7D32', in_progress: '#1565C0', enrolled: '#E65100', cancelled: '#9E9E9E' };
const EMPTY = { employee_id: '', course_name: '', provider: '', training_type: 'online', completion_date: '', hours: '', status: 'enrolled', notes: '' };

export default function TrainingPage() {
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formErr, setFormErr] = useState({});
  const [filterStatus, setFilterStatus] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const [r, e] = await Promise.all([trainingService.list(params), employeeService.list({ status: 'active' })]);
      setRecords(r.data);
      setEmployees(e.data);
    } catch { setSnack({ open: true, msg: 'Failed to load', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const openForm = (rec = null) => {
    setEditRec(rec);
    setForm(rec ? {
      employee_id: rec.employee_id, course_name: rec.course_name, provider: rec.provider || '',
      training_type: rec.training_type || 'online', completion_date: rec.completion_date?.split('T')[0] || '',
      hours: rec.hours || '', status: rec.status, notes: rec.notes || '',
    } : { ...EMPTY });
    setFormErr({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.employee_id) errs.employee_id = 'Select employee';
    if (!form.course_name.trim()) errs.course_name = 'Course name required';
    setFormErr(errs);
    return !Object.keys(errs).length;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editRec) { await trainingService.update(editRec.id, form); setSnack({ open: true, msg: 'Record updated', sev: 'success' }); }
      else { await trainingService.create(form); setSnack({ open: true, msg: 'Record added', sev: 'success' }); }
      setFormOpen(false); load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Failed', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await trainingService.delete(deleteId); setSnack({ open: true, msg: 'Deleted', sev: 'success' }); load(); }
    catch { setSnack({ open: true, msg: 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || `#${id}`;

  // Summary pie data
  const statusSummary = STATUSES.map(s => ({ name: s, value: records.filter(r => r.status === s).length })).filter(s => s.value > 0);
  const totalHours = records.filter(r => r.status === 'completed').reduce((s, r) => s + parseFloat(r.hours || 0), 0);

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Training Records</Typography>
            <Typography variant="body2" color="text.secondary">{records.length} record(s) · {totalHours}h completed</Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>Add Training</Button>}
          </Box>
        </Box>

        {loading ? <LoadingSpinner minHeight="40vh" /> : (
          <Box>
            {/* Summary card */}
            <Grid container spacing={3} mb={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>Completion Status</Typography>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={statusSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {statusSummary.map((s, i) => <Cell key={i} fill={COLORS[s.name] || '#9E9E9E'} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={8}>
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', height: '100%' }}>
                  <Table>
                    <TableHead><TableRow>
                      <TableCell>Employee</TableCell><TableCell>Course</TableCell><TableCell>Provider</TableCell>
                      <TableCell>Hours</TableCell><TableCell>Status</TableCell><TableCell>Completed</TableCell>
                      {canWrite && <TableCell align="right">Actions</TableCell>}
                    </TableRow></TableHead>
                    <TableBody>
                      {records.slice(0, 5).map(r => (
                        <TableRow key={r.id} hover>
                          <TableCell><Typography variant="body2" fontWeight={600}>{getEmpName(r.employee_id)}</Typography></TableCell>
                          <TableCell sx={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.course_name}</TableCell>
                          <TableCell>{r.provider || '—'}</TableCell>
                          <TableCell>{r.hours ? `${r.hours}h` : '—'}</TableCell>
                          <TableCell><Chip label={r.status.replace('_', ' ')} size="small" sx={{ bgcolor: `${COLORS[r.status]}20`, color: COLORS[r.status], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                          <TableCell>{r.completion_date ? new Date(r.completion_date).toLocaleDateString() : '—'}</TableCell>
                          {canWrite && (
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => openForm(r)}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error" onClick={() => { setDeleteId(r.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>

            {/* Full table */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Employee</TableCell><TableCell>Course</TableCell><TableCell>Provider</TableCell>
                  <TableCell>Type</TableCell><TableCell>Hours</TableCell><TableCell>Status</TableCell>
                  <TableCell>Completed</TableCell>{canWrite && <TableCell align="right">Actions</TableCell>}
                </TableRow></TableHead>
                <TableBody>
                  {records.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell fontWeight={600}>{getEmpName(r.employee_id)}</TableCell>
                      <TableCell>{r.course_name}</TableCell>
                      <TableCell>{r.provider || '—'}</TableCell>
                      <TableCell><Chip label={r.training_type} size="small" variant="outlined" /></TableCell>
                      <TableCell>{r.hours ? `${r.hours}h` : '—'}</TableCell>
                      <TableCell><Chip label={r.status.replace('_', ' ')} size="small" sx={{ bgcolor: `${COLORS[r.status]}20`, color: COLORS[r.status], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>
                      <TableCell>{r.completion_date ? new Date(r.completion_date).toLocaleDateString() : '—'}</TableCell>
                      {canWrite && (
                        <TableCell align="right">
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openForm(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { setDeleteId(r.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {!records.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No training records found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editRec ? 'Edit Training Record' : 'Add Training Record'}</DialogTitle>
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
              <TextField fullWidth label="Course Name *" value={form.course_name} onChange={e => setForm({ ...form, course_name: e.target.value })} error={!!formErr.course_name} helperText={formErr.course_name} size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Provider" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={form.training_type} onChange={e => setForm({ ...form, training_type: e.target.value })}>
                  {TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: 'capitalize' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Hours" type="number" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} size="small" />
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
              <TextField fullWidth label="Completion Date" type="date" value={form.completion_date} onChange={e => setForm({ ...form, completion_date: e.target.value })} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} size="small" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained">{editRec ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete Record" message="This will permanently delete this training record." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
