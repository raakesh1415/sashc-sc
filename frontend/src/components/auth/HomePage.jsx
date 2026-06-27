import { useState } from 'react';
import { Box, Typography, Button, Card, Divider, TextField, CircularProgress, useTheme } from '@mui/material';
import MyMessage from '../layout/Message';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_YEAR } from '../../YearContext';
import sasLogoImage from '../../assets/images/sas-logo.png';
import {
  Assessment as AssessmentIcon,
  Groups as GroupsIcon,
  BarChart as BarChartIcon,
  EmojiEvents as RankingIcon,
  ReportProblem as ReportIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_BACKEND_BASE_URL;

const features = [
  { icon: <AssessmentIcon sx={{ fontSize: 32 }} />, title: 'Pengurusan Markah',  desc: 'Rekod dan urus markah pelajar merentasi semua peperiksaan dengan mudah.' },
  { icon: <GroupsIcon    sx={{ fontSize: 32 }} />, title: 'Headcount Pelajar',   desc: 'Pantau prestasi pelajar mengikut kelas dan mata pelajaran secara menyeluruh.' },
  { icon: <BarChartIcon  sx={{ fontSize: 32 }} />, title: 'Analisis Prestasi',   desc: 'Laporan analisis terperinci untuk membantu guru membuat keputusan berasaskan data.' },
  { icon: <RankingIcon   sx={{ fontSize: 32 }} />, title: 'Kedudukan & GPI',     desc: 'Semak kedudukan pelajar dan Gred Purata Indeks (GPI) secara automatik.' },
];

const EMPTY_FORM = { name: '', email: '', title: '', description: '' };

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { secondary, btn } = theme.palette;

  const [form, setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]   = useState(null); // { color: 'green'|'red', msg }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      await axios.post(`${API_BASE}/feedback/`, form);
      setResult({ color: 'green', msg: 'Maklum balas berjaya dihantar. Terima kasih!' });
      setForm(EMPTY_FORM);
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Gagal menghantar maklum balas. Sila cuba lagi.';
      if (data?.message) {
        msg = data.message;
      } else if (data?.errors) {
        const messages = Object.entries(data.errors).map(
          ([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`
        );
        msg = messages.join(' | ');
      }
      setResult({ color: 'red', msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${secondary.main} 0%, ${btn.primary.gradient} 50%, ${btn.primary.hover} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 },
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 1300,
          borderRadius: 4,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <Box sx={{ bgcolor: 'background.paper', px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 }, textAlign: 'center' }}>
          <img src={sasLogoImage} alt="SAS Logo" style={{ height: 100, marginBottom: 16 }} />

          <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" letterSpacing={1} sx={{ mb: 0.5 }}>
            SEKOLAH MENENGAH ST. ANTHONY WP LABUAN
          </Typography>

          <Divider sx={{ my: 2, mx: 'auto', width: 60, borderWidth: 2, borderColor: secondary.main }} />

          <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: 2, mb: 0.5 }}>SASHC</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: 15 }}>
            Sistem Analisis &amp; Slip Headcount
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={() => navigate(`/${DEFAULT_YEAR}/login`)}
            sx={{
              px: 6, py: 1.5, fontWeight: 600, fontSize: 16,
              color: btn.primary.text, bgcolor: btn.primary.main, borderRadius: 2,
              boxShadow: '0 4px 15px rgba(0,255,239,0.4)',
              '&:hover': { bgcolor: btn.primary.hover, boxShadow: '0 6px 20px rgba(0,255,239,0.5)' },
            }}
          >
            Log Masuk
          </Button>
        </Box>

        {/* ── Features ── */}
        <Box sx={{ bgcolor: 'background.default', px: { xs: 3, md: 6 }, py: { xs: 4, md: 5 } }}>
          <Typography variant="overline" fontWeight="bold" color="text.secondary"
            display="block" textAlign="center" sx={{ mb: 3, letterSpacing: 2 }}>
            Ciri-Ciri Sistem
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {features.map((f, i) => (
              <Box key={i} sx={{
                bgcolor: 'background.paper', borderRadius: 3, p: 2.5, textAlign: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: `1px solid ${secondary.main}33`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
              }}>
                <Box sx={{ color: btn.primary.hover, mb: 1 }}>{f.icon}</Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{f.title}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.4}>{f.desc}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Feedback form ── */}
        <Box sx={{ bgcolor: 'background.paper', px: { xs: 3, md: 6 }, py: { xs: 4, md: 5 } }}>
          <Typography variant="overline" fontWeight="bold" color="text.secondary"
            display="block" textAlign="center" sx={{ mb: 1, letterSpacing: 2 }}>
            Hubungi Kami
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <ReportIcon sx={{ color: btn.primary.hover, fontSize: 24 }} />
            <Typography variant="h6" fontWeight={700} textAlign="center">
              Laporkan Masalah / Maklum Balas
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3, maxWidth: 520, mx: 'auto' }}>
            Jika anda menghadapi sebarang masalah atau ingin berkongsi maklum balas tentang sistem ini, sila isi borang di bawah.
          </Typography>

          {/* Form card */}
          <Box
            sx={{
              bgcolor: 'background.paper', borderRadius: 3, p: { xs: 3, md: 4 },
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              border: `1px solid ${secondary.main}33`,
              maxWidth: 900, mx: 'auto',
            }}
          >
            {result && (
              <MyMessage key={result.msg} messageText={result.msg} messagecolor={result.color} />
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <TextField
                  label="Nama" name="name" value={form.name}
                  onChange={handleChange} required fullWidth size="small"
                  placeholder="Masukkan nama anda"
                />
                <TextField
                  label="E-mel" name="email" value={form.email} type="email"
                  onChange={handleChange} required fullWidth size="small"
                  placeholder="Masukkan e-mel anda"
                />
              </Box>
              <TextField
                label="Tajuk" name="title" value={form.title}
                onChange={handleChange} required fullWidth size="small"
                placeholder="Ringkasan masalah atau maklum balas"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Penerangan" name="description" value={form.description}
                onChange={handleChange} required fullWidth multiline rows={4} size="small"
                placeholder="Huraikan masalah atau maklum balas anda dengan terperinci..."
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{
                  py: 1.4, fontWeight: 600, fontSize: 15,
                  color: btn.primary.text, bgcolor: btn.primary.main, borderRadius: 2,
                  boxShadow: '0 4px 14px rgba(0,255,239,0.35)',
                  '&:hover': { bgcolor: btn.primary.hover, boxShadow: '0 6px 18px rgba(0,255,239,0.45)' },
                }}
              >
                {submitting ? <><CircularProgress size={18} sx={{ mr: 1 }} />Menghantar...</> : 'Hantar Maklum Balas'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* ── Footer ── */}
        <Box sx={{ bgcolor: btn.back.main, px: 4, py: 2, textAlign: 'center' }}>
          <Typography variant="caption" color={btn.back.text}>
            © {new Date().getFullYear()} Sekolah Menengah St. Anthony WP Labuan. Hak cipta terpelihara.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default HomePage;
