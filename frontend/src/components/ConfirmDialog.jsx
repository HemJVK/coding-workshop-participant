import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm', message = 'Are you sure?' }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="error">Delete</Button>
      </DialogActions>
    </Dialog>
  );
}
