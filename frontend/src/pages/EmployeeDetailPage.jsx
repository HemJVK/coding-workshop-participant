import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Avatar, Button,
  Tab, Tabs, Table, TableBody, TableCell, TableHead, TableRow,
  Paper, LinearProgress, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';
import WorkIcon from '@mui/icons-material/Work';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip,
} from 'recharts';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { employeeService } from '../services/employeeService';
import { reviewService } from '../services/reviewService';
import { competencyService } from '../services/competencyService';
import { trainingService } from '../services/trainingService';
import { goalService } from '../services/goalService';
import { developmentService } from '../services/developmentService';

function TabPanel({ children, value, index }) {
  return value === index ? <Box pt={3}>{children}</Box> : null;
}

const STATUS_COL = { active: 'success', inactive: 'default', on_leave: 'warning' };
const TRAINING_COL = { completed: 'success', in_progress: 'info', enrolled: 'default' };

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [emp, setEmp] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [training, setTraining] = useState([]);
  const [goals, setGoals] = useState([]);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [e, r, c, tr, g, p] = await Promise.all([
          employeeService.get(id),
          reviewService.list({ employee_id: id }),
          competencyService.getEmployeeCompetencies(id),
          trainingService.list({ employee_id: id }),
          goalService.list({ employee_id: id }),
          developmentService.list({ employee_id: id }),
        ]);
        setEmp(e.data);
        setReviews(r.data);
        setCompetencies(c.data);
        setTraining(tr.data);
        setGoals(g.data);
        setPlans(p.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <Layout><LoadingSpinner /></Layout>;
  if (!emp) return <Layout><Typography>Employee not found.</Typography></Layout>;

  const avgRating = reviews.length ? (reviews.reduce((a, r) => a + parseFloat(r.rating || 0), 0) / reviews.length).toFixed(1) : '—';
  const radarData = competencies.map(c => ({ subject: c.competency_name, Current: c.current_level, Target: c.target_level }));

  return (
    <Layout>
      <Box className="fade-in">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/employees')} sx={{ mb: 2 }} variant="text">
          Back to Employees
        </Button>

        {/* Profile Header */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
              <Avatar sx={{ width: 72, height: 72, bgcolor: '#1565C0', fontSize: 28, fontWeight: 800 }}>
                {emp.name?.charAt(0)}
              </Avatar>
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <Typography variant="h5" fontWeight={800}>{emp.name}</Typography>
                  <Chip label={emp.status} size="small" color={STATUS_COL[emp.status] || 'default'} sx={{ textTransform: 'capitalize', fontWeight: 600 }} />
                </Box>
                <Typography color="text.secondary" fontWeight={500}>{emp.job_title || '—'}</Typography>
                <Box display="flex" flexWrap="wrap" gap={3} mt={1}>
                  {[
                    { icon: <EmailIcon fontSize="small" />, val: emp.email },
                    { icon: <PhoneIcon fontSize="small" />, val: emp.phone || '—' },
                    { icon: <BusinessIcon fontSize="small" />, val: emp.department || '—' },
                    { icon: <LocationOnIcon fontSize="small" />, val: emp.location || '—' },
                    { icon: <WorkIcon fontSize="small" />, val: emp.hire_date ? `Hired ${new Date(emp.hire_date).toLocaleDateString()}` : '—' },
                  ].map(({ icon, val }, i) => (
                    <Box key={i} display="flex" alignItems="center" gap={0.5} color="text.secondary">
                      {icon}<Typography variant="body2">{val}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box textAlign="center" sx={{ minWidth: 100, p: 2, bgcolor: '#F0F4F8', borderRadius: 2 }}>
                <Typography variant="h4" fontWeight={800} color="primary">{avgRating}</Typography>
                <Typography variant="caption" color="text.secondary">Avg Rating</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3 }}>
            {['Reviews', 'Competencies', 'Goals', 'Training', 'Dev Plans'].map((t, i) => (
              <Tab key={i} label={t} sx={{ fontWeight: 600, textTransform: 'none' }} />
            ))}
          </Tabs>

          <CardContent sx={{ p: 3 }}>
            {/* Reviews Tab */}
            <TabPanel value={tab} index={0}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Period</TableCell><TableCell>Year</TableCell>
                    <TableCell>Rating</TableCell><TableCell>Status</TableCell><TableCell>Comments</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {reviews.map(r => (
                      <TableRow key={r.id} hover>
                        <TableCell fontWeight={600}>{r.period}</TableCell>
                        <TableCell>{r.year}</TableCell>
                        <TableCell><Chip label={`${r.rating}★`} size="small" color={r.rating >= 4 ? 'success' : r.rating >= 3 ? 'warning' : 'error'} sx={{ fontWeight: 700 }} /></TableCell>
                        <TableCell><Chip label={r.status} size="small" variant="outlined" /></TableCell>
                        <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comments || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!reviews.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No reviews yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Paper>
            </TabPanel>

            {/* Competencies Tab */}
            <TabPanel value={tab} index={1}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Radar name="Current" dataKey="Current" stroke="#1565C0" fill="#1565C0" fillOpacity={0.3} />
                      <Radar name="Target" dataKey="Target" stroke="#00ACC1" fill="#00ACC1" fillOpacity={0.1} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  {competencies.map(c => (
                    <Box key={c.id} mb={2}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" fontWeight={600}>{c.competency_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.current_level}/5 (target: {c.target_level})</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={(c.current_level / 5) * 100}
                        sx={{ height: 8, borderRadius: 4, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: c.current_level < c.target_level ? '#E65100' : '#2E7D32' } }} />
                    </Box>
                  ))}
                  {!competencies.length && <Typography color="text.secondary">No competency data yet.</Typography>}
                </Grid>
              </Grid>
            </TabPanel>

            {/* Goals Tab */}
            <TabPanel value={tab} index={2}>
              {goals.map(g => (
                <Box key={g.id} mb={2.5} p={2} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography fontWeight={700}>{g.title}</Typography>
                    <Chip label={g.status.replace('_', ' ')} size="small" color={g.status === 'completed' ? 'success' : g.status === 'in_progress' ? 'info' : 'default'} sx={{ textTransform: 'capitalize' }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={1.5}>{g.description}</Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <LinearProgress variant="determinate" value={g.progress} sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                    <Typography variant="caption" fontWeight={700}>{g.progress}%</Typography>
                  </Box>
                </Box>
              ))}
              {!goals.length && <Typography color="text.secondary">No goals set.</Typography>}
            </TabPanel>

            {/* Training Tab */}
            <TabPanel value={tab} index={3}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Course</TableCell><TableCell>Provider</TableCell>
                    <TableCell>Hours</TableCell><TableCell>Status</TableCell><TableCell>Completion</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {training.map(t => (
                      <TableRow key={t.id} hover>
                        <TableCell fontWeight={600}>{t.course_name}</TableCell>
                        <TableCell>{t.provider || '—'}</TableCell>
                        <TableCell>{t.hours || '—'}h</TableCell>
                        <TableCell><Chip label={t.status} size="small" color={TRAINING_COL[t.status] || 'default'} /></TableCell>
                        <TableCell>{t.completion_date ? new Date(t.completion_date).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!training.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No training records</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Paper>
            </TabPanel>

            {/* Dev Plans Tab */}
            <TabPanel value={tab} index={4}>
              {plans.map(p => (
                <Box key={p.id} mb={2} p={2.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography fontWeight={700}>{p.title}</Typography>
                    <Chip label={p.status} size="small" color={p.status === 'active' ? 'success' : 'default'} />
                  </Box>
                  {p.objectives && <Typography variant="body2" color="text.secondary" mb={0.5}><strong>Objectives:</strong> {p.objectives}</Typography>}
                  {p.actions && <Typography variant="body2" color="text.secondary" mb={0.5}><strong>Actions:</strong> {p.actions}</Typography>}
                  {p.start_date && <Typography variant="caption" color="text.muted">{new Date(p.start_date).toLocaleDateString()} → {p.end_date ? new Date(p.end_date).toLocaleDateString() : 'Ongoing'}</Typography>}
                </Box>
              ))}
              {!plans.length && <Typography color="text.secondary">No development plans.</Typography>}
            </TabPanel>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
