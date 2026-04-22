import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import './index.css';

const theme = createTheme({
  palette: {
    primary:   { main: '#1565C0', light: '#1976D2', dark: '#0D47A1' },
    secondary: { main: '#00ACC1', light: '#26C6DA', dark: '#00838F' },
    background: { default: '#F0F4F8', paper: '#FFFFFF' },
    success:   { main: '#2E7D32' },
    warning:   { main: '#E65100' },
    error:     { main: '#C62828' },
    text: { primary: '#1A202C', secondary: '#4A5568' },
  },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,0.08)',
    '0 2px 6px rgba(0,0,0,0.08)',
    '0 4px 12px rgba(0,0,0,0.08)',
    '0 6px 16px rgba(0,0,0,0.10)',
    ...Array(20).fill('0 8px 32px rgba(0,0,0,0.12)'),
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 20px', boxShadow: 'none', '&:hover': { boxShadow: '0 4px 12px rgba(21,101,192,0.25)' } },
        containedPrimary: { background: 'linear-gradient(135deg, #1565C0, #1976D2)' },
      },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #EDF2F7' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, backgroundColor: '#F7FAFC', color: '#4A5568' } } },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
