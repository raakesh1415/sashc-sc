import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Typography, Card, CardContent, Avatar, Chip,
  CircularProgress, List, ListItem, ListItemAvatar, ListItemText,
} from "@mui/material";
import {
  People, Assignment, EmojiEvents,
  TrendingUp, BarChart as BarChartIcon, ShowChart,
  Groups, PieChart as PieChartIcon, Assessment,
} from "@mui/icons-material";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { useYear } from "../../YearContext";
import axiosInstance from "../../AxiosInstance";

const ACCENT = "#00ffef";

const EXAM_OPTIONS = [
  { key: "TOV", label: "TOV", color: "#7c3aed" },
  { key: "AR1", label: "AR1", color: "#0ea5e9" },
  { key: "AR2", label: "AR2", color: "#10b981" },
  { key: "ETR", label: "ETR", color: "#f59e0b" },
];

// A+/A/A- → greens | B+/B/C+/C → blues | D+/D/E → ambers | G → red | TH/— → gray
const GRADE_COLOR = (grade) => {
  if (!grade || grade === "TH")               return "#9ca3af";
  if (["A+", "A", "A-"].includes(grade))      return "#10b981";
  if (["B+", "B", "C+", "C"].includes(grade)) return "#0ea5e9";
  if (["D+", "D", "E"].includes(grade))       return "#f59e0b";
  return "#ef4444"; // G
};

const ROLE_COLORS_MAP = {
  Admin:             "#7c3aed",
  "Subject Teacher": "#0ea5e9",
  "Class Teacher":   "#10b981",
  Student:           "#f59e0b",
};

const TEACHER_ROLE_LABELS = {
  Admin:             "PENTADBIR",
  "Class Teacher":   "GURU KELAS",
  "Subject Teacher": "GURU MATAPELAJARAN",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: "rgba(15,15,35,0.95)", color: "#fff", p: 1.5, borderRadius: 1.5, border: `1px solid ${ACCENT}`, fontSize: 12 }}>
      <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, color: ACCENT }}>{label}</Typography>
      {payload.map((e, i) => (
        <Typography key={i} variant="caption" display="block" sx={{ color: e.color || "#fff" }}>
          {e.name}: <strong>{e.value}</strong>
        </Typography>
      ))}
    </Box>
  );
};

const StatCard = ({ icon, title, value, subtitle, color, loading }) => (
  <Card className="dash-stat-card" sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden", height: "100%" }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>{title}</Typography>
          {loading
            ? <CircularProgress size={28} sx={{ color }} />
            : <Typography variant="h3" fontWeight={800} sx={{ color, lineHeight: 1 }}>{value ?? "—"}</Typography>}
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{subtitle}</Typography>
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${color}1a`, width: 56, height: 56 }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 28 } })}
        </Avatar>
      </Box>
    </CardContent>
    <Box sx={{ height: 4, background: color }} />
  </Card>
);

// ── Main component ────────────────────────────────────────────────────────────
const TeacherDashboard = () => {
  const year = useYear();

  const [selectedExam,  setSelectedExam]  = useState("TOV");
  const [analysisMap,   setAnalysisMap]   = useState({ TOV: [], AR1: [], AR2: [], ETR: [] });
  const [summaryMap,    setSummaryMap]    = useState({ TOV: null, AR1: null, AR2: null, ETR: null });
  const [rankingMap,    setRankingMap]    = useState({ TOV: [], AR1: [], AR2: [], ETR: [] });
  const [users,         setUsers]         = useState([]);
  const [classes,       setClasses]       = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [userName,      setUserName]      = useState("");
  const [userRoles,     setUserRoles]     = useState([]);

  const userEmail = localStorage.getItem("userEmail") || "";

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        axiosInstance.get("/users/"),
        axiosInstance.get("/classes/"),
        axiosInstance.get("/subjects/"),
        axiosInstance.get("/analysis-exam/?exam=TOV"),
        axiosInstance.get("/analysis-exam/?exam=AR1"),
        axiosInstance.get("/analysis-exam/?exam=AR2"),
        axiosInstance.get("/analysis-exam/?exam=ETR"),
        axiosInstance.get("/ranking-overall/?exam=TOV"),
        axiosInstance.get("/ranking-overall/?exam=AR1"),
        axiosInstance.get("/ranking-overall/?exam=AR2"),
        axiosInstance.get("/ranking-overall/?exam=ETR"),
      ]);
      const safe = (r) => {
        if (r.status !== "fulfilled") return [];
        const d = r.value.data;
        return d?.data ?? (Array.isArray(d) ? d : []);
      };
      const safeSummary = (r) =>
        r.status === "fulfilled" ? r.value.data?.studentSummary ?? null : null;

      const allUsers = safe(results[0]);
      setUsers(allUsers);
      setClasses(safe(results[1]));
      setSubjects(safe(results[2]));
      setAnalysisMap({ TOV: safe(results[3]), AR1: safe(results[4]), AR2: safe(results[5]), ETR: safe(results[6]) });
      setSummaryMap({ TOV: safeSummary(results[3]), AR1: safeSummary(results[4]), AR2: safeSummary(results[5]), ETR: safeSummary(results[6]) });
      setRankingMap({ TOV: safe(results[7]), AR1: safe(results[8]), AR2: safe(results[9]), ETR: safe(results[10]) });
      const me = allUsers.find((u) => u.email === userEmail);
      if (me?.name)  setUserName(me.name);
      if (me?.role)  setUserRoles(Array.isArray(me.role) ? me.role : [me.role]);
      setLoading(false);
    };
    fetchAll();
  }, [year]);

  // ── Active exam data ────────────────────────────────────────────────────────
  const analysis       = analysisMap[selectedExam];
  const studentSummary = summaryMap[selectedExam];
  const ranking        = rankingMap[selectedExam];
  const examColor      = EXAM_OPTIONS.find((e) => e.key === selectedExam)?.color || ACCENT;

  // ── Derived stats ────────────────────────────────────────────────────────────
  const countRole     = (r) => users.filter((u) => (Array.isArray(u.role) ? u.role.includes(r) : u.role === r)).length;
  const totalStudents = studentSummary?.totalStudents ?? countRole("Student");
  const passRate      = studentSummary ? studentSummary.lulusPersen : "0.0";
  const totalLulus    = studentSummary?.lulusBil ?? 0;
  const totalGagal    = studentSummary?.gagalBil ?? 0;

  const gps = useMemo(() => {
    if (!analysis.length) return "0.00";
    let totalPoints = 0;
    let totalAmbil  = 0;
    analysis.forEach((r) => {
      totalPoints +=
        (r.gradeAPlus  || 0) * 0 +
        (r.gradeA      || 0) * 1 +
        (r.gradeAMinus || 0) * 2 +
        (r.gradeBPlus  || 0) * 3 +
        (r.gradeB      || 0) * 4 +
        (r.gradeCPlus  || 0) * 5 +
        (r.gradeC      || 0) * 6 +
        (r.gradeD      || 0) * 7 +
        (r.gradeE      || 0) * 8 +
        (r.gradeG      || 0) * 9;
      totalAmbil += r.ambil || 0;
    });
    return totalAmbil > 0 ? (totalPoints / totalAmbil).toFixed(2) : "0.00";
  }, [analysis]);

  const top3 = useMemo(
    () => [...ranking].sort((a, b) => (a.ranking || 99) - (b.ranking || 99)).slice(0, 3),
    [ranking]
  );

  const topStudent = useMemo(
    () => [...ranking].sort((a, b) => (a.ranking || 99) - (b.ranking || 99))[0] || null,
    [ranking]
  );

  // ── Chart data ────────────────────────────────────────────────────────────────
  const gradeDistData = [
    { grade: "A+", count: analysis.reduce((s, r) => s + (r.gradeAPlus  || 0), 0), fill: GRADE_COLOR("A+") },
    { grade: "A",  count: analysis.reduce((s, r) => s + (r.gradeA      || 0), 0), fill: GRADE_COLOR("A")  },
    { grade: "A-", count: analysis.reduce((s, r) => s + (r.gradeAMinus || 0), 0), fill: GRADE_COLOR("A-") },
    { grade: "B+", count: analysis.reduce((s, r) => s + (r.gradeBPlus  || 0), 0), fill: GRADE_COLOR("B+") },
    { grade: "B",  count: analysis.reduce((s, r) => s + (r.gradeB      || 0), 0), fill: GRADE_COLOR("B")  },
    { grade: "C+", count: analysis.reduce((s, r) => s + (r.gradeCPlus  || 0), 0), fill: GRADE_COLOR("C+") },
    { grade: "C",  count: analysis.reduce((s, r) => s + (r.gradeC      || 0), 0), fill: GRADE_COLOR("C")  },
    { grade: "D",  count: analysis.reduce((s, r) => s + (r.gradeD      || 0), 0), fill: GRADE_COLOR("D")  },
    { grade: "E",  count: analysis.reduce((s, r) => s + (r.gradeE      || 0), 0), fill: GRADE_COLOR("E")  },
    { grade: "G",  count: analysis.reduce((s, r) => s + (r.gradeG      || 0), 0), fill: GRADE_COLOR("G")  },
  ].filter((d) => d.count > 0);

  const passFail = [
    { name: "Lulus", value: totalLulus, color: "#10b981" },
    { name: "Gagal", value: totalGagal, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const roleData = [
    { name: "Admin",              value: countRole("Admin"),           color: ROLE_COLORS_MAP.Admin },
    { name: "Guru Matapelajaran", value: countRole("Subject Teacher"), color: ROLE_COLORS_MAP["Subject Teacher"] },
    { name: "Guru Kelas",         value: countRole("Class Teacher"),   color: ROLE_COLORS_MAP["Class Teacher"] },
    { name: "Pelajar",            value: countRole("Student"),         color: ROLE_COLORS_MAP.Student },
  ].filter((d) => d.value > 0);



  const gpiRanges = useMemo(() => {
    const ranges = [
      { label: "0.00–0.99",  min: 0,  max: 1,        color: "#10b981" },
      { label: "1.00–1.99",  min: 1,  max: 2,        color: "#26A69A" },
      { label: "2.00–2.99",  min: 2,  max: 3,        color: "#4DB6AC" },
      { label: "3.00–3.99",  min: 3,  max: 4,        color: "#42A5F5" },
      { label: "4.00–4.99",  min: 4,  max: 5,        color: "#64B5F6" },
      { label: "5.00–5.99",  min: 5,  max: 6,        color: "#FFA726" },
      { label: "6.00–6.99",  min: 6,  max: 7,        color: "#FFB74D" },
      { label: "7.00–7.99",  min: 7,  max: 8,        color: "#EF5350" },
      { label: "8.00–8.99",  min: 8,  max: 9,        color: "#E53935" },
      { label: "9.00–9.99",  min: 9,  max: 10,       color: "#C62828" },
      { label: "10.00+",     min: 10, max: Infinity, color: "#B71C1C" },
    ];
    return ranges
      .map((r) => ({
        ...r,
        count: ranking.filter((s) => {
          const g = parseFloat(s.gpi);
          return r.max === Infinity ? g >= r.min : g >= r.min && g < r.max;
        }).length,
      }))
      .filter((r) => r.count > 0);
  }, [ranking]);

  // ── Hero background ───────────────────────────────────────────────────────────
  const isAdmin        = userRoles.includes("Admin");
  const isClassTeacher = userRoles.includes("Class Teacher");

  const heroBg = isAdmin
    ? "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d3b6e 100%)"
    : isClassTeacher
    ? "linear-gradient(135deg, #0a2e1a 0%, #1a4a2e 50%, #0d5c3a 100%)"
    : "linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d4a6e 100%)";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ mx: "auto" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Box className="dash-hero" sx={{
        background: heroBg, borderRadius: 3, p: { xs: 3, md: 4 }, mb: 3, color: "#fff",
        position: "relative", overflow: "hidden",
      }}>
        <Box sx={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", bgcolor: `${ACCENT}0d` }} />
        <Box sx={{ position: "absolute", bottom: -40, right: 120, width: 150, height: 150, borderRadius: "50%", bgcolor: "#ffffff08" }} />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
            {userRoles.filter((r) => r !== "Student").map((role) => (
              <Chip key={role} label={TEACHER_ROLE_LABELS[role] || role.toUpperCase()} size="small"
                sx={{ bgcolor: ACCENT, color: "#000", fontWeight: 800, fontSize: 10, letterSpacing: 0.5 }} />
            ))}
            <Typography variant="caption" sx={{ color: "#aaa" }}>Sesi {year}</Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
            Selamat datang, {loading ? "…" : (userName || userEmail)} 👋
          </Typography>
          <Typography variant="body2" sx={{ color: "#aaa", mb: 2.5 }}>
            Pantau prestasi akademik pelajar dan analisis data peperiksaan sesi {year}
          </Typography>

          {/* Exam selector inside hero */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {EXAM_OPTIONS.map(({ key, label, color }) => (
              <Chip
                key={key}
                label={label}
                onClick={() => setSelectedExam(key)}
                sx={{
                  fontWeight: 700, fontSize: 13, cursor: "pointer", px: 0.5,
                  bgcolor:   selectedExam === key ? color : "rgba(255,255,255,0.12)",
                  color:     selectedExam === key ? "#fff" : "#ccc",
                  border:    `2px solid ${selectedExam === key ? color : "transparent"}`,
                  "&:hover": { bgcolor: selectedExam === key ? color : "rgba(255,255,255,0.2)" },
                  transition: "all 0.2s",
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2.5, mb: 3 }}>
        <StatCard icon={<Groups />}     title="Jumlah Pelajar"                  value={totalStudents}  subtitle="Sesi ini"             color="#7c3aed" loading={loading} />
        <StatCard icon={<TrendingUp />} title={`Kadar Lulus (${selectedExam})`} value={`${passRate}%`} subtitle="Keseluruhan"          color="#0ea5e9"  loading={loading} />
        <StatCard icon={<Assessment />} title={`Purata GPS (${selectedExam})`}  value={gps}            subtitle="Sekolah"  color="#10b981" loading={loading} />
        <StatCard icon={<EmojiEvents />}title={`Pelajar #1 (${selectedExam})`}  value={loading ? "…" : (topStudent?.gpi ?? "—")} subtitle={topStudent?.studentName ?? "Tiada data"} color="#f59e0b" loading={loading} />
      </Box>

      {/* ── Row 1: Grade Distribution + Pass/Fail + Users by Role ─────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2.5, mb: 3 }}>

        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
            <BarChartIcon sx={{ color: examColor }} />
            <Typography variant="h6" fontWeight={700}>Taburan Gred — {selectedExam}</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : gradeDistData.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gradeDistData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Bilangan" radius={[4, 4, 0, 0]}>
                  {gradeDistData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Pass / Fail */}
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <PieChartIcon sx={{ color: "#10b981" }} />
              <Typography variant="subtitle1" fontWeight={700}>Lulus / Gagal — {selectedExam}</Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : passFail.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Tiada data</Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={passFail} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={3}>
                      {passFail.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ flex: 1 }}>
                  {passFail.map((e) => (
                    <Box key={e.name} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color }} />
                        <Typography variant="caption">{e.name}</Typography>
                      </Box>
                      <Typography variant="caption" fontWeight={700}>{e.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Card>

          {/* Users by Role */}
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <People sx={{ color: "#7c3aed" }} />
              <Typography variant="subtitle1" fontWeight={700}>Pengguna Mengikut Peranan</Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <ResponsiveContainer width={100} height={100}>
                  <PieChart>
                    <Pie data={roleData} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" paddingAngle={3}>
                      {roleData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box>
                  {roleData.map((e) => (
                    <Box key={e.name} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: e.color }} />
                      <Typography variant="caption">{e.name}: <strong>{e.value}</strong></Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Card>
        </Box>
      </Box>

      {/* ── Taburan GPI + 3 Pelajar Terbaik ──────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 2.5, mb: 3 }}>

        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
            <ShowChart sx={{ color: "#0ea5e9" }} />
            <Typography variant="h6" fontWeight={700}>Taburan GPI Pelajar — {selectedExam}</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : gpiRanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={gpiRanges} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
                <defs>
                  <linearGradient id="gpiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Bilangan Pelajar"
                  stroke="#0ea5e9" strokeWidth={2} fill="url(#gpiGradient)" dot={{ r: 4, fill: "#0ea5e9" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <EmojiEvents sx={{ color: "#f59e0b" }} />
            <Typography variant="h6" fontWeight={700}>3 Pelajar Terbaik — {selectedExam}</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : top3.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data kedudukan</Typography>
          ) : (
            <List dense disablePadding>
              {top3.map((s, i) => {
                const medal = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32";
                return (
                  <ListItem key={i} disablePadding sx={{ mb: 1.5, bgcolor: `${medal}0d`, borderRadius: 2, px: 1.5, py: 0.75 }}>
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{ bgcolor: medal, color: "#000", fontWeight: 800, width: 32, height: 32, fontSize: 14 }}>{i + 1}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600} noWrap>{s.studentName}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary">{s.className} · GPI {s.gpi}</Typography>}
                    />
                    <Chip label={s.status} size="small" color={s.status === "LULUS" ? "success" : "error"} sx={{ fontSize: 10, height: 20, fontWeight: 700 }} />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Card>

      </Box>


    </Box>
  );
};

export default TeacherDashboard;
