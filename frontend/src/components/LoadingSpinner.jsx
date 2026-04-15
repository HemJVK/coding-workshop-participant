import { Box, CircularProgress } from '@mui/material';

export default function LoadingSpinner({ size = 48, minHeight = '60vh' }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight={minHeight}>
      <CircularProgress size={size} thickness={4} />
    </Box>
  );
}
