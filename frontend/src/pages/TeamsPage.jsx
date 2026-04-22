import { useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, IconButton, InputAdornment, InputLabel,
  MenuItem, Paper, Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import SnackbarAlert from '../components/SnackbarAlert';
import ConfirmDialog from '../components/ConfirmDialog';
import { authService } from '../services/authService';
import { teamService } from '../services/teamService';
import { employeeService } from '../services/employeeService';

const TEAM_TYPES = ['engineering', 'product', 'operations', 'delivery', 'shared-services'];
const EMPTY_TEAM = {
  name: '',
  description: '',
  team_type: 'delivery',
  status: 'active',
  primary_location: '',
  leader_employee_id: '',
  owner_user_id: '',
  org_leader_employee_id: '',
};
const EMPTY_MEMBER = { employee_id: '', role_title: '', direct_staff: true, is_team_lead: false };
const EMPTY_ACHIEVEMENT = { achievement_month: '', title: '', description: '', impact_metric: '' };
const EMPTY_METADATA = { meta_key: '', meta_value: '' };

export default function TeamsPage() {
  const user = authService.getUser();
  const canManage = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'active', location: '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' });

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [editingTeam, setEditingTeam] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [editingMetadata, setEditingMetadata] = useState(null);

  const [teamForm, setTeamForm] = useState({ ...EMPTY_TEAM });
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [achievementForm, setAchievementForm] = useState({ ...EMPTY_ACHIEVEMENT });
  const [metadataForm, setMetadataForm] = useState({ ...EMPTY_METADATA });

  const loadTeams = async (preferredTeamId = selectedTeamId) => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.location) params.location = filters.location;
      const [teamRes, employeeRes] = await Promise.all([
        teamService.list(params),
        employeeService.list({ status: 'active' }),
      ]);
      const nextTeams = teamRes.data || [];
      setTeams(nextTeams);
      setEmployees(employeeRes.data || []);

      const nextSelected = preferredTeamId || nextTeams[0]?.id || null;
      setSelectedTeamId(nextSelected);
      if (nextSelected) {
        const detail = await teamService.get(nextSelected);
        setSelectedTeam(detail.data);
      } else {
        setSelectedTeam(null);
      }
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to load teams', sev: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, [filters.status, filters.location]);

  const openTeamDialog = (team = null) => {
    setEditingTeam(team);
    setTeamForm(team ? {
      name: team.name,
      description: team.description || '',
      team_type: team.team_type || 'delivery',
      status: team.status || 'active',
      primary_location: team.primary_location || '',
      leader_employee_id: team.leader_employee_id || '',
      owner_user_id: team.owner_user_id || '',
      org_leader_employee_id: team.org_leader_employee_id || '',
    } : { ...EMPTY_TEAM });
    setTeamDialogOpen(true);
  };

  const openMemberDialog = (member = null) => {
    setEditingMember(member);
    setMemberForm(member ? {
      employee_id: member.employee_id,
      role_title: member.role_title || '',
      direct_staff: !!member.direct_staff,
      is_team_lead: !!member.is_team_lead,
    } : { ...EMPTY_MEMBER });
    setMemberDialogOpen(true);
  };

  const openAchievementDialog = (achievement = null) => {
    setEditingAchievement(achievement);
    setAchievementForm(achievement ? {
      achievement_month: achievement.achievement_month?.slice?.(0, 7) || '',
      title: achievement.title || '',
      description: achievement.description || '',
      impact_metric: achievement.impact_metric || '',
    } : { ...EMPTY_ACHIEVEMENT });
    setAchievementDialogOpen(true);
  };

  const openMetadataDialog = (metadata = null) => {
    setEditingMetadata(metadata);
    setMetadataForm(metadata ? { meta_key: metadata.meta_key || '', meta_value: metadata.meta_value || '' } : { ...EMPTY_METADATA });
    setMetadataDialogOpen(true);
  };

  const handleSearchChange = (e) => setFilters({ ...filters, search: e.target.value });
  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') loadTeams();
  };

  const handleSelectTeam = async (teamId) => {
    setSelectedTeamId(teamId);
    setLoading(true);
    try {
      const detail = await teamService.get(teamId);
      setSelectedTeam(detail.data);
    } catch (e) {
      setSnack({ open: true, msg: 'Failed to load team details', sev: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeam = async () => {
    try {
      if (editingTeam) {
        await teamService.update(editingTeam.id, teamForm);
        setSnack({ open: true, msg: 'Team updated', sev: 'success' });
      } else {
        const res = await teamService.create(teamForm);
        setSnack({ open: true, msg: 'Team created', sev: 'success' });
        setSelectedTeamId(res.data.id);
      }
      setTeamDialogOpen(false);
      await loadTeams(editingTeam?.id || selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to save team', sev: 'error' });
    }
  };

  const handleDeleteTeam = async () => {
    try {
      await teamService.delete(selectedTeamId);
      setSnack({ open: true, msg: 'Team deleted', sev: 'success' });
      setConfirmOpen(false);
      await loadTeams(null);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to delete team', sev: 'error' });
    }
  };

  const handleSaveMember = async () => {
    try {
      if (editingMember) {
        await teamService.updateMember(selectedTeamId, editingMember.employee_id, memberForm);
        setSnack({ open: true, msg: 'Team member updated', sev: 'success' });
      } else {
        await teamService.addMember(selectedTeamId, memberForm);
        setSnack({ open: true, msg: 'Team member added', sev: 'success' });
      }
      setMemberDialogOpen(false);
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to save team member', sev: 'error' });
    }
  };

  const handleDeleteMember = async (employeeId) => {
    try {
      await teamService.removeMember(selectedTeamId, employeeId);
      setSnack({ open: true, msg: 'Team member removed', sev: 'success' });
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to remove team member', sev: 'error' });
    }
  };

  const handleSaveAchievement = async () => {
    try {
      if (editingAchievement) {
        await teamService.updateAchievement(selectedTeamId, editingAchievement.id, achievementForm);
        setSnack({ open: true, msg: 'Achievement updated', sev: 'success' });
      } else {
        await teamService.createAchievement(selectedTeamId, achievementForm);
        setSnack({ open: true, msg: 'Achievement created', sev: 'success' });
      }
      setAchievementDialogOpen(false);
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to save achievement', sev: 'error' });
    }
  };

  const handleDeleteAchievement = async (achievementId) => {
    try {
      await teamService.deleteAchievement(selectedTeamId, achievementId);
      setSnack({ open: true, msg: 'Achievement deleted', sev: 'success' });
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to delete achievement', sev: 'error' });
    }
  };

  const handleSaveMetadata = async () => {
    try {
      if (editingMetadata) {
        await teamService.updateMetadata(selectedTeamId, editingMetadata.id, metadataForm);
        setSnack({ open: true, msg: 'Metadata updated', sev: 'success' });
      } else {
        await teamService.createMetadata(selectedTeamId, metadataForm);
        setSnack({ open: true, msg: 'Metadata added', sev: 'success' });
      }
      setMetadataDialogOpen(false);
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to save metadata', sev: 'error' });
    }
  };

  const handleDeleteMetadata = async (metadataId) => {
    try {
      await teamService.deleteMetadata(selectedTeamId, metadataId);
      setSnack({ open: true, msg: 'Metadata deleted', sev: 'success' });
      await handleSelectTeam(selectedTeamId);
    } catch (e) {
      setSnack({ open: true, msg: e.response?.data?.error || 'Failed to delete metadata', sev: 'error' });
    }
  };

  const employeeOptions = employees.map((employee) => ({
    ...employee,
    label: `${employee.name} — ${employee.department || 'No dept'}`,
  }));

  const locationOptions = Array.from(new Set(teams.map((team) => team.primary_location).filter(Boolean))).sort();

  if (loading && !selectedTeam && !teams.length) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <Box className="fade-in">
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Teams</Typography>
            <Typography variant="body2" color="text.secondary">
              Centralized team structure, locations, achievements, and metadata.
            </Typography>
          </Box>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openTeamDialog()}>
              Add Team
            </Button>
          )}
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <TextField
                placeholder="Search teams..."
                size="small"
                value={filters.search}
                onChange={handleSearchChange}
                onKeyDown={handleSearchSubmit}
                sx={{ minWidth: 260 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Location</InputLabel>
                <Select label="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
                  <MenuItem value="">All</MenuItem>
                  {locationOptions.map((location) => <MenuItem key={location} value={location}>{location}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={() => loadTeams()}>Search</Button>
            </Box>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Team</TableCell>
                    <TableCell>Leader</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Members</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow
                      key={team.id}
                      hover
                      selected={team.id === selectedTeamId}
                      onClick={() => handleSelectTeam(team.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <GroupsIcon color="primary" fontSize="small" />
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{team.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{team.team_type}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{team.leader_name || '—'}</TableCell>
                      <TableCell>{team.primary_location || '—'}</TableCell>
                      <TableCell>{team.member_count}</TableCell>
                    </TableRow>
                  ))}
                  {!teams.length && (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No teams found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Grid>

          <Grid item xs={12} md={7}>
            {selectedTeam ? (
              <Box display="flex" flexDirection="column" gap={3}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" gap={2} flexWrap="wrap">
                      <Box>
                        <Typography variant="h6" fontWeight={800}>{selectedTeam.name}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {selectedTeam.description || 'No description provided.'}
                        </Typography>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
                          <Chip label={`Leader: ${selectedTeam.leader_name || '—'}`} size="small" />
                          <Chip label={`Org leader: ${selectedTeam.org_leader_name || '—'}`} size="small" />
                          <Chip label={`Primary location: ${selectedTeam.primary_location || '—'}`} size="small" />
                          <Chip label={`Members: ${selectedTeam.member_count || 0}`} size="small" color="primary" />
                          <Chip label={`Non-direct ratio: ${Math.round((selectedTeam.non_direct_staff_ratio || 0) * 100)}%`} size="small" color="warning" />
                        </Box>
                      </Box>
                      {canManage && (
                        <Box display="flex" gap={1}>
                          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => openTeamDialog(selectedTeam)}>Edit</Button>
                          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setConfirmOpen(true)}>Delete</Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>Team Members</Typography>
                      {canManage && <Button size="small" startIcon={<AddIcon />} onClick={() => openMemberDialog()}>Add Member</Button>}
                    </Box>
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Employee</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Direct Staff</TableCell>
                            {canManage && <TableCell align="right">Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedTeam.members?.map((member) => (
                            <TableRow key={member.employee_id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{member.employee_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{member.department}</Typography>
                              </TableCell>
                              <TableCell>{member.role_title || member.job_title || '—'}</TableCell>
                              <TableCell>{member.location || '—'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={member.direct_staff ? 'Direct' : 'Non-direct'}
                                  size="small"
                                  color={member.direct_staff ? 'success' : 'warning'}
                                />
                              </TableCell>
                              {canManage && (
                                <TableCell align="right">
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => openMemberDialog(member)}><EditIcon fontSize="small" /></IconButton>
                                  </Tooltip>
                                  <Tooltip title="Remove">
                                    <IconButton size="small" color="error" onClick={() => handleDeleteMember(member.employee_id)}><DeleteIcon fontSize="small" /></IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {!selectedTeam.members?.length && (
                            <TableRow><TableCell colSpan={canManage ? 5 : 4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No team members yet</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>Monthly Achievements</Typography>
                      {canManage && <Button size="small" startIcon={<AddIcon />} onClick={() => openAchievementDialog()}>Add Achievement</Button>}
                    </Box>
                    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Month</TableCell>
                            <TableCell>Achievement</TableCell>
                            <TableCell>Impact</TableCell>
                            {canManage && <TableCell align="right">Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedTeam.achievements?.map((achievement) => (
                            <TableRow key={achievement.id} hover>
                              <TableCell>{achievement.achievement_month?.slice?.(0, 7) || '—'}</TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{achievement.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{achievement.description || '—'}</Typography>
                              </TableCell>
                              <TableCell>{achievement.impact_metric || '—'}</TableCell>
                              {canManage && (
                                <TableCell align="right">
                                  <Tooltip title="Edit">
                                    <IconButton size="small" onClick={() => openAchievementDialog(achievement)}><EditIcon fontSize="small" /></IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={() => handleDeleteAchievement(achievement.id)}><DeleteIcon fontSize="small" /></IconButton>
                                  </Tooltip>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {!selectedTeam.achievements?.length && (
                            <TableRow><TableCell colSpan={canManage ? 4 : 3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No achievements recorded yet</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>Team Metadata</Typography>
                      {canManage && <Button size="small" startIcon={<AddIcon />} onClick={() => openMetadataDialog()}>Add Metadata</Button>}
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1.5}>
                      {selectedTeam.metadata?.map((item) => (
                        <Paper key={item.id} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{item.meta_key}</Typography>
                              <Typography variant="body2" color="text.secondary">{item.meta_value || '—'}</Typography>
                            </Box>
                            {canManage && (
                              <Box display="flex" gap={1}>
                                <IconButton size="small" onClick={() => openMetadataDialog(item)}><EditIcon fontSize="small" /></IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteMetadata(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      ))}
                      {!selectedTeam.metadata?.length && (
                        <Typography variant="body2" color="text.secondary">No metadata added yet.</Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Card><CardContent><Typography color="text.secondary">Select a team to view details.</Typography></CardContent></Card>
            )}
          </Grid>
        </Grid>
      </Box>

      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Team Name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Description" value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={teamForm.team_type} onChange={(e) => setTeamForm({ ...teamForm, team_type: e.target.value })}>
                  {TEAM_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={teamForm.status} onChange={(e) => setTeamForm({ ...teamForm, status: e.target.value })}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Primary Location" value={teamForm.primary_location} onChange={(e) => setTeamForm({ ...teamForm, primary_location: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Team Leader</InputLabel>
                <Select label="Team Leader" value={teamForm.leader_employee_id} onChange={(e) => setTeamForm({ ...teamForm, leader_employee_id: e.target.value })}>
                  <MenuItem value="">None</MenuItem>
                  {employeeOptions.map((employee) => <MenuItem key={employee.id} value={employee.id}>{employee.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Org Leader</InputLabel>
                <Select label="Org Leader" value={teamForm.org_leader_employee_id} onChange={(e) => setTeamForm({ ...teamForm, org_leader_employee_id: e.target.value })}>
                  <MenuItem value="">None</MenuItem>
                  {employeeOptions.map((employee) => <MenuItem key={employee.id} value={employee.id}>{employee.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Owner User ID" type="number" value={teamForm.owner_user_id} onChange={(e) => setTeamForm({ ...teamForm, owner_user_id: e.target.value })} helperText="Auth user id used for manager-level ownership filters." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTeamDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSaveTeam} variant="contained">{editingTeam ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Employee</InputLabel>
                <Select
                  label="Employee"
                  value={memberForm.employee_id}
                  onChange={(e) => setMemberForm({ ...memberForm, employee_id: e.target.value })}
                  disabled={!!editingMember}
                >
                  {employeeOptions.map((employee) => <MenuItem key={employee.id} value={employee.id}>{employee.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Role Title" value={memberForm.role_title} onChange={(e) => setMemberForm({ ...memberForm, role_title: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Direct Staff</InputLabel>
                <Select label="Direct Staff" value={memberForm.direct_staff ? 'yes' : 'no'} onChange={(e) => setMemberForm({ ...memberForm, direct_staff: e.target.value === 'yes' })}>
                  <MenuItem value="yes">Direct</MenuItem>
                  <MenuItem value="no">Non-direct</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Team Lead</InputLabel>
                <Select label="Team Lead" value={memberForm.is_team_lead ? 'yes' : 'no'} onChange={(e) => setMemberForm({ ...memberForm, is_team_lead: e.target.value === 'yes' })}>
                  <MenuItem value="yes">Yes</MenuItem>
                  <MenuItem value="no">No</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSaveMember} variant="contained">{editingMember ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={achievementDialogOpen} onClose={() => setAchievementDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAchievement ? 'Edit Achievement' : 'Add Monthly Achievement'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Month" type="month" value={achievementForm.achievement_month} onChange={(e) => setAchievementForm({ ...achievementForm, achievement_month: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Title" value={achievementForm.title} onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Description" value={achievementForm.description} onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Impact Metric" value={achievementForm.impact_metric} onChange={(e) => setAchievementForm({ ...achievementForm, impact_metric: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAchievementDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSaveAchievement} variant="contained">{editingAchievement ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={metadataDialogOpen} onClose={() => setMetadataDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMetadata ? 'Edit Metadata' : 'Add Metadata'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Key" value={metadataForm.meta_key} onChange={(e) => setMetadataForm({ ...metadataForm, meta_key: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Value" value={metadataForm.meta_value} onChange={(e) => setMetadataForm({ ...metadataForm, meta_value: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetadataDialogOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSaveMetadata} variant="contained">{editingMetadata ? 'Save' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeleteTeam}
        title="Delete Team"
        message="This will remove the team, its members, achievements, and metadata."
      />
      <SnackbarAlert open={snack.open} onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} message={snack.msg} />
    </Layout>
  );
}
