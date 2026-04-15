import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, FormControl,
  InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, TextField, Rating, Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { reviewService } from '../services/reviewService';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'Mid-Year'];
const STATUSES = ['draft', 'submitted', 'acknowledged'];
const RATING_COLORS = { 5: 'success', 4: 'success', 3: 'warning', 2: 'warning', 1: 'error' };

const EMPTY_FORM = { employee_id: '', period: 'Annual', year: new Date().getFullYear(), rating: 3, comments: '', strengths: '', improvements: '', status: 'draft' };

export default function ReviewsPage() {
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'contributor'].includes(user?.role);

  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ period: '', status: '', year: '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRev, setEditRev] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErr, setFormErr] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.period) params.period = filters.period;
      if (filters.status) params.status = filters.status;
      if (filters.year) params.year = filters.year;
      const [r, e] = await Promise.all([reviewService.list(params), employeeService.list({ status: 'active' })]);
      setReviews(r.data);
      setEmployees(e.data);
    } catch { setSnack({ open: true, msg: 'Failed to load', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filters]);

  const openForm = (rev = null) => {
    setEditRev(rev);
    setForm(rev ? { employee_id: rev.employee_id, period: rev.period, year: rev.year, rating: rev.rating, comments: rev.comments || '', strengths: rev.strengths || '', improvements: rev.improvements || '', status: rev.status } : { ...EMPTY_FORM });
    setFormErr({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.employee_id) errs.employee_id = 'Select an employee';
    if (!form.period) errs.period = 'Period is required';
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editRev) { await reviewService.update(editRev.id, form); setSnack({ open: true, msg: 'Review updated', sev: 'success' }); }
      else { await reviewService.create(form); setSnack({ open: true, msg: 'Review created', sev: 'success' }); }
      setFormOpen(false); load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Failed to save', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await reviewService.delete(deleteId); setSnack({ open: true, msg: 'Review deleted', sev: 'success' }); load(); }
    catch { setSnack({ open: true, msg: 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  const getEmpName = (id) => employees.find(e => e.id === id)?.name || `#${id}`;

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Performance Reviews</Typography>
            <Typography variant="body2" color="text.secondary">{reviews.length} review(s)</Typography>
          </Box>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>New Review</Button>}
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" gap={2} flexWrap="wrap">
              {[
                { label: 'Period', key: 'period', options: PERIODS },
                { label: 'Status', key: 'status', options: STATUSES },
              ].map(({ label, key, options }) => (
                <FormControl size="small" sx={{ minWidth: 140 }} key={key}>
                  <InputLabel>{label}</InputLabel>
                  <Select label={label} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}>
                    <MenuItem value="">All</MenuItem>
                    {options.map(o => <MenuItem key={o} value={o} sx={{ textTransform: 'capitalize' }}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              ))}
              <TextField label="Year" size="small" type="number" value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })} sx={{ width: 100 }} />
            </Box>
          </CardContent>
        </Card>

        {loading ? <LoadingSpinner minHeight="40vh" /> : (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead><TableRow>
                <TableCell>Employee</TableCell><TableCell>Period</TableCell><TableCell>Year</TableCell>
                <TableCell>Rating</TableCell><TableCell>Status</TableCell>
                <TableCell>Strengths</TableCell>{user?.role === 'admin' && <TableCell align="right">Actions</TableCell>}
              </TableRow></TableHead>
              <TableBody>
                {reviews.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: '#1565C0', fontSize: 11, fontWeight: 700 }}>{getEmpName(r.employee_id)?.charAt(0)}</Avatar>
                        {getEmpName(r.employee_id)}
                      </Box>
                    </TableCell>
                    <TableCell>{r.period}</TableCell>
                    <TableCell>{r.year}</TableCell>
                    <TableCell>
                      <Chip label={`${r.rating}★`} size="small" color={RATING_COLORS[Math.round(r.rating)] || 'default'} sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell><Chip label={r.status} size="small" variant="outlined" color={r.status === 'acknowledged' ? 'success' : r.status === 'submitted' ? 'info' : 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.strengths || '—'}</TableCell>
                    {user?.role === 'admin' && (
                      <TableCell align="right">
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openForm(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { setDeleteId(r.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!reviews.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No reviews found</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {/* Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editRev ? 'Edit Review' : 'New Performance Review'}</DialogTitle>
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
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Period *</InputLabel>
                <Select label="Period *" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>
                  {PERIODS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Year" type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} size="small" />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" fontWeight={600} gutterBottom>Rating *</Typography>
              <Rating value={parseFloat(form.rating)} precision={0.5} onChange={(_, v) => setForm({ ...form, rating: v })} size="large" />
            </Grid>
            {[{ name: 'comments', label: 'Overall Comments', rows: 3 }, { name: 'strengths', label: 'Strengths', rows: 2 }, { name: 'improvements', label: 'Areas for Improvement', rows: 2 }].map(({ name, label, rows }) => (
              <Grid item xs={12} key={name}>
                <TextField fullWidth multiline rows={rows} label={label} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} size="small" />
              </Grid>
            ))}
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
          <Button onClick={handleSave} variant="contained">{editRev ? 'Save' : 'Create Review'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete Review" message="This will permanently delete the review." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
