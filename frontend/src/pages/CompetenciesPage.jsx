import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, LinearProgress,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, MenuItem,
  Select, FormControl, InputLabel, IconButton, Tooltip, Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { competencyService } from '../services/competencyService';
import { employeeService } from '../services/employeeService';
import { authService } from '../services/authService';

const CATEGORIES = ['Technical', 'Leadership', 'Soft Skills', 'Management', 'Cognitive', 'Process'];
const COLORS = ['#1565C0', '#00ACC1', '#2E7D32', '#E65100', '#7B1FA2', '#C62828'];

export default function CompetenciesPage() {
  const user = authService.getUser();
  const canWrite = ['admin', 'manager', 'hr'].includes(user?.role);

  const [competencies, setCompetencies] = useState([]);
  const [, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'Technical' });
  const [formErr, setFormErr] = useState({});
  const [skillGapData, setSkillGapData] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([competencyService.list(), employeeService.list({ status: 'active' })]);
      setCompetencies(c.data);
      setEmployees(e.data);

      // Build skill-gap heatmap data: avg current level per competency
      const empIds = e.data.map(emp => emp.id);
      const assessments = await Promise.all(empIds.slice(0, 8).map(id => competencyService.getEmployeeCompetencies(id).catch(() => ({ data: [] }))));
      const allAssess = assessments.flatMap(a => a.data);

      const gaps = c.data.map(comp => {
        const relevant = allAssess.filter(a => a.competency_id === comp.id);
        const avgCurrent = relevant.length ? relevant.reduce((s, a) => s + a.current_level, 0) / relevant.length : 0;
        const avgTarget = relevant.length ? relevant.reduce((s, a) => s + a.target_level, 0) / relevant.length : 0;
        return { name: comp.name, avgCurrent: parseFloat(avgCurrent.toFixed(1)), gap: parseFloat(Math.max(0, avgTarget - avgCurrent).toFixed(1)) };
      }).sort((a, b) => b.gap - a.gap);
      setSkillGapData(gaps.slice(0, 8));
    } catch { setSnack({ open: true, msg: 'Failed to load', sev: 'error' }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await competencyService.create(form);
      setSnack({ open: true, msg: 'Competency added', sev: 'success' });
      setFormOpen(false);
      setForm({ name: '', description: '', category: 'Technical' });
      load();
    } catch (e) { setSnack({ open: true, msg: e.response?.data?.error || 'Failed', sev: 'error' }); }
  };

  const handleDelete = async () => {
    try { await competencyService.delete(deleteId); setSnack({ open: true, msg: 'Deleted', sev: 'success' }); load(); }
    catch { setSnack({ open: true, msg: 'Delete failed', sev: 'error' }); }
    finally { setConfirmOpen(false); setDeleteId(null); }
  };

  const catGroups = competencies.reduce((g, c) => { (g[c.category] = g[c.category] || []).push(c); return g; }, {});

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Competencies</Typography>
            <Typography variant="body2" color="text.secondary">{competencies.length} defined competencies</Typography>
          </Box>
          {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>Add Competency</Button>}
        </Box>

        {loading ? <LoadingSpinner /> : (
          <Grid container spacing={3}>
            {/* Skill Gap Chart */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>Organizational Skill Gap Analysis</Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Average gap between target and current level per competency (higher = larger gap)
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={skillGapData} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis domain={[0, 5]} />
                      <RTooltip formatter={(v, n) => [v, n === 'avgCurrent' ? 'Avg Current Level' : 'Skill Gap']} />
                      <Bar dataKey="avgCurrent" name="Avg Current" stackId="a" fill="#1565C0" radius={[0,0,0,0]}>
                        {skillGapData.map((_, i) => <Cell key={i} fill="#1565C0" />)}
                      </Bar>
                      <Bar dataKey="gap" name="Skill Gap" stackId="a" fill="#E6510080" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Competency Cards by Category */}
            {Object.entries(catGroups).map(([cat, comps], ci) => (
              <Grid item xs={12} md={6} key={cat}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[ci % COLORS.length] }} />
                      <Typography variant="h6" fontWeight={700}>{cat}</Typography>
                      <Chip label={comps.length} size="small" sx={{ ml: 'auto', bgcolor: `${COLORS[ci % COLORS.length]}15`, color: COLORS[ci % COLORS.length], fontWeight: 700 }} />
                    </Box>
                    {comps.map(c => (
                      <Box key={c.id} display="flex" justifyContent="space-between" alignItems="center" py={1} sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { border: 0 } }}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                          {c.description && <Typography variant="caption" color="text.secondary">{c.description}</Typography>}
                        </Box>
                        {canWrite && user?.role === 'admin' && (
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => { setDeleteId(c.id); setConfirmOpen(true); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Add Competency</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} error={!!formErr.name} helperText={formErr.name} size="small" fullWidth />
            <TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} size="small" fullWidth />
            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDelete} title="Delete Competency" message="This will permanently remove this competency and all related assessments." />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
