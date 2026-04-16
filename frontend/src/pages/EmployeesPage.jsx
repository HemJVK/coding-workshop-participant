import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, InputAdornment, Chip, Avatar, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography,
  MenuItem, Select, FormControl, InputLabel, Tooltip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';

const DEPARTMENTS = ['Engineering', 'Product', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations', 'Legal'];
const STATUS_COLORS = { active: 'success', inactive: 'default', on_leave: 'warning' };

export default function EmployeesPage() {
  const navigate = useNavigate();
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'hr'].includes(user?.role);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', department: '', job_title: '', hire_date: '', phone: '', location: '', status: 'active' });
  const [formErr, setFormErr] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (deptFilter) params.department = deptFilter;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await employeeService.list(params);
      setEmployees(data);
    } catch {
      setSnack({ open: true, msg: 'Failed to load employees', sev: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [deptFilter, statusFilter]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') load();
    setSearch(e.target.value);
  };

  const openForm = (emp = null) => {
    setEditEmp(emp);
    setForm(emp ? { name: emp.name, email: emp.email, department: emp.department || '', job_title: emp.job_title || '', hire_date: emp.hire_date?.split('T')[0] || '', phone: emp.phone || '', location: emp.location || '', status: emp.status } : { name: '', email: '', department: '', job_title: '', hire_date: '', phone: '', location: '', status: 'active' });
    setFormErr({});
    setFormOpen(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email';
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editEmp) {
        await employeeService.update(editEmp.id, form);
        setSnack({ open: true, msg: 'Employee updated successfully', sev: 'success' });
      } else {
        await employeeService.create(form);
        setSnack({ open: true, msg: 'Employee created successfully', sev: 'success' });
      }
      setFormOpen(false);
      load();
    } catch {
      setSnack({ open: true, msg: 'Operation failed', sev: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await employeeService.delete(deleteId);
      setSnack({ open: true, msg: 'Employee deactivated', sev: 'success' });
      load();
    } catch {
      setSnack({ open: true, msg: 'Delete failed', sev: 'error' });
    } finally { setConfirmOpen(false); setDeleteId(null); }
  };

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Employees</Typography>
            <Typography variant="body2" color="text.secondary">{employees.length} employee(s) found</Typography>
          </Box>
          {canWrite && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>Add Employee</Button>
          )}
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField
                placeholder="Search name, email, title…" size="small" value={search}
                onChange={handleSearch} onKeyDown={(e) => e.key === 'Enter' && load()}
                sx={{ minWidth: 260 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Department</InputLabel>
                <Select label="Department" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" size="small" onClick={load}>Search</Button>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        {loading ? <LoadingSpinner minHeight="40vh" /> : (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Hire Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#1565C0', fontSize: 14, fontWeight: 700 }}>
                          {emp.name?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{emp.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{emp.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{emp.department || '—'}</TableCell>
                    <TableCell>{emp.job_title || '—'}</TableCell>
                    <TableCell>{emp.location || '—'}</TableCell>
                    <TableCell>
                      <Chip label={emp.status} size="small" color={STATUS_COLORS[emp.status] || 'default'} sx={{ textTransform: 'capitalize', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Profile">
                        <IconButton size="small" onClick={() => navigate(`/employees/${emp.id}`)} color="primary">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canWrite && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openForm(emp)}><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Deactivate">
                            <IconButton size="small" color="error" onClick={() => { setDeleteId(emp.id); setConfirmOpen(true); }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {employees.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No employees found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>

      {/* Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editEmp ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {[
              { name: 'name', label: 'Full Name', required: true },
              { name: 'email', label: 'Email Address', required: true },
              { name: 'job_title', label: 'Job Title' },
              { name: 'phone', label: 'Phone' },
              { name: 'location', label: 'Location' },
              { name: 'hire_date', label: 'Hire Date', type: 'date', InputLabelProps: { shrink: true } },
            ].map(({ name, label, required, type, InputLabelProps }) => (
              <Grid item xs={12} sm={6} key={name}>
                <TextField fullWidth label={label} name={name} type={type || 'text'} value={form[name]}
                  onChange={e => setForm({ ...form, [name]: e.target.value })}
                  error={!!formErr[name]} helperText={formErr[name]} required={required}
                  InputLabelProps={InputLabelProps} />
              </Grid>
            ))}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="on_leave">On Leave</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained">{editEmp ? 'Save Changes' : 'Add Employee'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete}
        title="Deactivate Employee" message="This will mark the employee as inactive. Continue?" />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
