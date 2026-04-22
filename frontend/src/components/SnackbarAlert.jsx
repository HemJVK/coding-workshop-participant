import { Snackbar, Alert } from '@mui/material';

export default function SnackbarAlert({ open, onClose, severity = 'success', message }) {
  return (
    <Snackbar open={open} autoHideDuration={4000} onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert onClose={onClose} severity={severity} variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
