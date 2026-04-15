import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Divider, Alert,
  LinearProgress, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, Paper, Avatar,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import StarIcon from '@mui/icons-material/Star';
import WarningIcon from '@mui/icons-material/Warning';
import Layout from '../components/Layout';
import KPICard from '../components/KPICard';
import LoadingSpinner from '../components/LoadingSpinner';
import { employeeService } from '../services/employeeService';
import { reviewService } from '../services/reviewService';
import { trainingService } from '../services/trainingService';
import { goalService } from '../services/goalService';

const COLORS = ['#1565C0', '#00ACC1', '#2E7D32', '#E65100', '#7B1FA2'];

const RATING_LABELS = { 5: 'Exceptional', 4: 'Exceeds', 3: 'Meets', 2: 'Below', 1: 'Unsatisfactory' };

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({ employees: 0, avgRating: 0, trainingCompleted: 0, goalsInProgress: 0 });
  const [deptData, setDeptData] = useState([]);
  const [ratingDist, setRatingDist] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [atRisk, setAtRisk] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [emps, reviews, training, goals] = await Promise.all([
          employeeService.list({ status: 'active' }),
          reviewService.list({}),
          trainingService.list({}),
          goalService.list({}),
        ]);

        const empList = emps.data;
        const revList = reviews.data;
        const trainList = training.data;
        const goalList = goals.data;

        setEmployees(empList);

        // KPI
        const ratingsArr = revList.filter(r => r.rating).map(r => parseFloat(r.rating));
        const avg = ratingsArr.length ? (ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length).toFixed(1) : 0;
        const trainDone = trainList.filter(t => t.status === 'completed').length;
        const goalsIP = goalList.filter(g => g.status === 'in_progress').length;
        setKpi({ employees: empList.length, avgRating: avg, trainingCompleted: trainDone, goalsInProgress: goalsIP });

        // Dept distribution
        const deptMap = {};
        empList.forEach(e => { deptMap[e.department || 'Other'] = (deptMap[e.department || 'Other'] || 0) + 1; });
        setDeptData(Object.entries(deptMap).map(([dept, count]) => ({ dept, count })));

        // Rating distribution
        const rdist = [5, 4, 3, 2, 1].map(r => ({
          rating: `${r}★ ${RATING_LABELS[r]}`,
          count: revList.filter(rv => Math.round(parseFloat(rv.rating)) === r).length,
        }));
        setRatingDist(rdist);

        // Recent reviews
        setRecentReviews(revList.slice(0, 5));

        // At-risk detection (rating < 3)
        const lowRated = revList.filter(r => r.rating && parseFloat(r.rating) < 3);
        const atRiskIds = [...new Set(lowRated.map(r => r.employee_id))];
        setAtRisk(empList.filter(e => atRiskIds.includes(e.id)));

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <Box className="fade-in">
        <Typography variant="h5" fontWeight={800} gutterBottom>Overview</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Organizational performance snapshot across all employees and teams.
        </Typography>

        {/* KPI Cards */}
        <Grid container spacing={3} mb={4}>
          {[
            { title: 'Total Employees', value: kpi.employees, icon: <PeopleIcon />, color: '#1565C0', subtitle: 'Active employees', trend: 'up', trendLabel: 'All active' },
            { title: 'Avg. Performance Rating', value: `${kpi.avgRating} / 5`, icon: <StarIcon />, color: '#E65100', subtitle: 'Across all reviews', trend: kpi.avgRating >= 4 ? 'up' : 'down', trendLabel: kpi.avgRating >= 4 ? 'Strong performance' : 'Needs attention' },
            { title: 'Training Completed', value: kpi.trainingCompleted, icon: <SchoolIcon />, color: '#2E7D32', subtitle: 'Courses finished', trend: 'up', trendLabel: 'Ongoing learning' },
            { title: 'Active Goals', value: kpi.goalsInProgress, icon: <FlagIcon />, color: '#7B1FA2', subtitle: 'Goals in progress', trend: 'up', trendLabel: 'Career development' },
          ].map((k, i) => (
            <Grid item xs={12} sm={6} lg={3} key={i}>
              <KPICard {...k} />
            </Grid>
          ))}
        </Grid>

        {/* At-Risk Alert */}
        {atRisk.length > 0 && (
          <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3, borderRadius: 2 }}>
            <Typography fontWeight={700} gutterBottom>⚠ Attrition Risk Alert</Typography>
            <Typography variant="body2">
              {atRisk.length} employee(s) have performance ratings below 3.0 and may need immediate attention:{' '}
              {atRisk.map(e => e.name).join(', ')}.
            </Typography>
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Department Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Employees by Department</Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={deptData} dataKey="count" nameKey="dept" cx="50%" cy="50%" outerRadius={90} label={({ dept, percent }) => `${dept} ${(percent * 100).toFixed(0)}%`}>
                      {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Rating Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Performance Rating Distribution</Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ratingDist} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="rating" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1565C0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Reviews */}
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Recent Performance Reviews</Typography>
                <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Period</TableCell>
                        <TableCell>Year</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentReviews.map(r => {
                        const emp = employees.find(e => e.id === r.employee_id);
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#1565C0' }}>
                                  {emp?.name?.charAt(0) || '?'}
                                </Avatar>
                                {emp?.name || `Employee #${r.employee_id}`}
                              </Box>
                            </TableCell>
                            <TableCell>{r.period}</TableCell>
                            <TableCell>{r.year}</TableCell>
                            <TableCell>
                              <Chip
                                label={`${r.rating}★`} size="small"
                                color={r.rating >= 4 ? 'success' : r.rating >= 3 ? 'warning' : 'error'}
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip label={r.status} size="small" variant="outlined"
                                color={r.status === 'acknowledged' ? 'success' : r.status === 'submitted' ? 'info' : 'default'} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {recentReviews.length === 0 && (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No reviews yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Paper>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
}
