import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

export default function KPICard({ title, value, subtitle, icon, color = '#1565C0', trend, trendLabel }) {
  const TrendIcon = trend === 'up' ? TrendingUpIcon : TrendingDownIcon;
  const trendColor = trend === 'up' ? '#2E7D32' : '#C62828';

  return (
    <Card sx={{ height: '100%', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 } }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} color="text.primary" sx={{ lineHeight: 1.1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {trendLabel && (
              <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
                <Typography variant="caption" sx={{ color: trendColor, fontWeight: 600 }}>{trendLabel}</Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ width: 52, height: 52, bgcolor: `${color}18`, color }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
}
