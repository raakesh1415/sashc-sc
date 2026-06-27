import React, { useEffect, useState, useMemo } from "react";
import {
  Box, Typography, Card, CardContent, Avatar, Chip,
  CircularProgress, Divider,
} from "@mui/material";
import {
  EmojiEvents, BarChart as BarChartIcon, Assignment,
  TrendingUp, Analytics, Star, CheckCircle, Cancel,
} from "@mui/icons-material";
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useYear } from "../../YearContext";
import axiosInstance from "../../AxiosInstance";

const ACCENT = "#00ffef";

const EXAM_META = [
  { key: "TOV", label: "TOV",  color: "#7c3aed", subtitle: "PAT T4" },
  { key: "AR1", label: "AR1",  color: "#0ea5e9", subtitle: "PPT T5" },
  { key: "AR2", label: "AR2",  color: "#10b981", subtitle: "PERCUBAAN" },
  { key: "ETR", label: "ETR",  color: "#f59e0b", subtitle: "TARGET SPM" },
];

const GRADE_COLOR = (grade) => {
  if (!grade || grade === "TH")                    return "#9ca3af"; // gray
  if (["A+", "A", "A-"].includes(grade))           return "#10b981"; // green
  if (["B+", "B", "C+", "C"].includes(grade))      return "#0ea5e9"; // blue
  if (["D+", "D", "E"].includes(grade))            return "#f59e0b"; // amber
  return "#ef4444"; // G — red
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.fullName ?? label;
  return (
    <Box sx={{ bgcolor: "rgba(15,15,35,0.92)", color: "#fff", p: 1.5, borderRadius: 1.5, border: `1px solid ${ACCENT}`, fontSize: 12, maxWidth: 220 }}>
      <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5, color: ACCENT, whiteSpace: "normal", wordBreak: "break-word" }}>{displayLabel}</Typography>
      {payload.map((e, i) => (
        <Typography key={i} variant="caption" display="block" sx={{ color: e.color || "#fff" }}>
          {e.name}: <strong>{e.value}</strong>
        </Typography>
      ))}
    </Box>
  );
};

const StudentDashboard = () => {
  const year = useYear();

  const [examData,     setExamData]     = useState({ TOV: null, AR1: null, AR2: null, ETR: null });
  const [ranking,      setRanking]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [userName,     setUserName]     = useState("");
  const [selectedExam, setSelectedExam] = useState("TOV");

  const userEmail = localStorage.getItem("userEmail") || "";

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        axiosInstance.get("/analysis-self/?exam=TOV"),
        axiosInstance.get("/analysis-self/?exam=AR1"),
        axiosInstance.get("/analysis-self/?exam=AR2"),
        axiosInstance.get("/analysis-self/?exam=ETR"),
        axiosInstance.get("/ranking-overall/?exam=TOV"),
        axiosInstance.get("/users/"),
      ]);
      const safeExam = (r) => {
        if (r.status !== "fulfilled") return null;
        return r.value.data;
      };
      const safeList = (r) => {
        if (r.status !== "fulfilled") return [];
        const d = r.value.data;
        return d?.data ?? (Array.isArray(d) ? d : []);
      };
      setExamData({
        TOV: safeExam(results[0]),
        AR1: safeExam(results[1]),
        AR2: safeExam(results[2]),
        ETR: safeExam(results[3]),
      });
      setRanking(safeList(results[4]));
      const users = safeList(results[5]);
      const me = users.find((u) => u.email === userEmail);
      if (me?.name) setUserName(me.name);
      setLoading(false);
    };
    fetchAll();
  }, [year]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const studentRank = useMemo(() => {
    const email = localStorage.getItem("userEmail");
    // We don't have student name directly, match by ranking list
    // Just return top ranking entry if available
    return ranking.find((r) => r.ranking === 1) ? ranking.find((r) => r.ranking === 1) : null;
  }, [ranking]);

  // Current student's rank from ranking list (can't match by email, so show total count)
  const totalInRanking = ranking.length;

  // GPI values for the 4 exam cards (always fixed)
  const tovGPI = examData.TOV?.gpi?.grade;
  const ar1GPI = examData.AR1?.gpi?.grade;
  const ar2GPI = examData.AR2?.gpi?.grade;
  const etrGPI = examData.ETR?.gpi?.grade;

  // Selected exam data for charts
  const selData     = examData[selectedExam];
  const selSubjects = selData?.data || [];
  const selGPI      = selData?.gpi?.grade;
  const selStatus   = selData?.status;

  // Subject marks bar chart (from selected exam) — unique short names
  const subjectMarks = useMemo(() => {
    const fullNames = selSubjects.map((s) => s.subjectName || "");
    const shortName = (name, idx) => {
      for (let len = 10; len <= name.length; len++) {
        const candidate = len < name.length ? name.slice(0, len) + "…" : name;
        const unique = !fullNames.some((other, j) => {
          if (j === idx) return false;
          const otherCandidate = len < other.length ? other.slice(0, len) + "…" : other;
          return otherCandidate === candidate;
        });
        if (unique) return candidate;
      }
      return name;
    };
    return selSubjects.map((s, i) => ({
      name:     shortName(fullNames[i], i),
      fullName: fullNames[i],
      markah:   parseFloat(s.mark) || 0,
      fill:     GRADE_COLOR(s.grade),
    }));
  }, [selSubjects]);

  // GPI trend line across all 4 exams
  const gpiTrend = [
    { exam: "TOV", GPI: parseFloat(examData.TOV?.gpi?.grade) || 0 },
    { exam: "AR1", GPI: parseFloat(examData.AR1?.gpi?.grade) || 0 },
    { exam: "AR2", GPI: parseFloat(examData.AR2?.gpi?.grade) || 0 },
    { exam: "ETR", GPI: parseFloat(examData.ETR?.gpi?.grade) || 0 },
  ].filter((e) => e.GPI > 0);

  // Grade distribution pie for selected exam
  const gradeCount = {};
  selSubjects.forEach((s) => {
    if (s.grade && s.grade !== "TH") {
      gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
    }
  });
  const gradePie = Object.entries(gradeCount).map(([grade, count]) => ({
    name: grade, value: count, color: GRADE_COLOR(grade),
  }));

  // Radar: subject performance for selected exam
  const radarData = useMemo(() => {
    const fullNames = selSubjects.map((s) => s.subjectName || "");
    const shortName = (name, idx) => {
      for (let len = 8; len <= name.length; len++) {
        const candidate = len < name.length ? name.slice(0, len) + "…" : name;
        const unique = !fullNames.some((other, j) => {
          if (j === idx) return false;
          const otherCandidate = len < other.length ? other.slice(0, len) + "…" : other;
          return otherCandidate === candidate;
        });
        if (unique) return candidate;
      }
      return name;
    };
    return selSubjects.map((s, i) => ({
      subject:  shortName(fullNames[i], i),
      fullName: fullNames[i],
      Markah:   parseFloat(s.mark) || 0,
    }));
  }, [selSubjects]);

  const examCards = [
    { ...EXAM_META[0], gpi: tovGPI, status: examData.TOV?.status },
    { ...EXAM_META[1], gpi: ar1GPI, status: examData.AR1?.status },
    { ...EXAM_META[2], gpi: ar2GPI, status: examData.AR2?.status },
    { ...EXAM_META[3], gpi: etrGPI, status: examData.ETR?.status },
  ];

  return (
    <Box sx={{ mx: "auto" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box className="dash-hero" sx={{
        background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b69 50%, #11998e 100%)",
        borderRadius: 3, p: { xs: 3, md: 4 }, mb: 3, color: "#fff",
        position: "relative", overflow: "hidden",
      }}>
        <Box sx={{ position: "absolute", top: -50, right: -50, width: 220, height: 220, borderRadius: "50%", bgcolor: `${ACCENT}0a` }} />
        <Box sx={{ position: "absolute", bottom: -40, left: "50%", width: 180, height: 180, borderRadius: "50%", bgcolor: "#ffffff06" }} />

        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Chip label="PELAJAR" size="small" sx={{ bgcolor: ACCENT, color: "#000", fontWeight: 800, fontSize: 10, letterSpacing: 0.5 }} />
            <Typography variant="caption" sx={{ color: "#aaa" }}>Sesi {year}</Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
            Selamat datang, {loading ? "…" : (userName || userEmail)} 👋
          </Typography>
          <Typography variant="body2" sx={{ color: "#aaa" }}>
            Pantau pencapaian akademik dan kedudukan anda
          </Typography>

          {/* Exam selector */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5, mb: 1.5 }}>
            {EXAM_META.map((exam) => (
              <Chip
                key={exam.key}
                label={exam.label}
                onClick={() => setSelectedExam(exam.key)}
                sx={{
                  fontWeight: 700, fontSize: 12, cursor: "pointer",
                  bgcolor: selectedExam === exam.key ? exam.color : "rgba(255,255,255,0.12)",
                  color:   selectedExam === exam.key ? "#fff"      : "#ccc",
                  border:  selectedExam === exam.key ? `2px solid ${exam.color}` : "2px solid transparent",
                  "&:hover": { bgcolor: `${exam.color}cc`, color: "#fff" },
                  transition: "all 0.2s ease",
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1 }}>
            {[
              { label: `GPI (${selectedExam})`, val: loading ? "…" : (selGPI || "—") },
              { label: "Status",                val: loading ? "…" : (selStatus || "—") },
              { label: "Matapelajaran",         val: loading ? "…" : selSubjects.length },
            ].map((s) => (
              <Box key={s.label} sx={{ bgcolor: "rgba(255,255,255,0.08)", borderRadius: 2, px: 2, py: 1 }}>
                <Typography variant="caption" sx={{ color: "#aaa", display: "block" }}>{s.label}</Typography>
                <Typography variant="body2" fontWeight={700}
                  sx={{ color: s.label === "Status" ? (s.val === "LULUS" ? "#10b981" : s.val === "GAGAL" ? "#ef4444" : "#fff") : "#fff" }}>
                  {s.val}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Exam GPI Cards ───────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2.5, mb: 3 }}>
        {examCards.map((exam) => (
          <Card key={exam.key} className="dash-stat-card" sx={{
            borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden",
            position: "relative",
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5 }}>{exam.label}</Typography>
              <Typography variant="caption" color="text.secondary">{exam.subtitle}</Typography>
              <Box sx={{ mt: 1.5, mb: 1 }}>
                {loading ? (
                  <CircularProgress size={24} sx={{ color: exam.color }} />
                ) : exam.gpi ? (
                  <Typography variant="h3" fontWeight={800} sx={{ color: exam.color, lineHeight: 1 }}>{exam.gpi}</Typography>
                ) : (
                  <Typography variant="h4" fontWeight={500} color="text.secondary">—</Typography>
                )}
              </Box>
              {exam.status && !loading && (
                <Chip
                  label={exam.status}
                  size="small"
                  icon={exam.status === "LULUS" ? <CheckCircle sx={{ fontSize: "14px !important" }} /> : <Cancel sx={{ fontSize: "14px !important" }} />}
                  color={exam.status === "LULUS" ? "success" : "error"}
                  sx={{ fontSize: 10, height: 22, fontWeight: 700 }}
                />
              )}
            </CardContent>
            <Box sx={{ height: 4, background: exam.color }} />
          </Card>
        ))}
      </Box>

      {/* ── Charts Row 1 ─────────────────────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "4fr 2fr" }, gap: 2.5, mb: 3 }}>

        {/* Subject marks bar */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
            <BarChartIcon sx={{ color: "#0ea5e9" }} />
            <Typography variant="h6" fontWeight={700}>Markah Mengikut Matapelajaran ({selectedExam})</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : subjectMarks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data markah {selectedExam}</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjectMarks} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="markah" name="Markah" radius={[4, 4, 0, 0]}>
                  {subjectMarks.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Right column: grade pie + gpi trend */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>

          {/* Grade pie */}
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <Star sx={{ color: "#f59e0b" }} />
              <Typography variant="subtitle1" fontWeight={700}>Taburan Gred ({selectedExam})</Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : gradePie.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Tiada data</Typography>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={gradePie} cx="50%" cy="50%" innerRadius={24} outerRadius={40} dataKey="value" paddingAngle={3}>
                      {gradePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, flex: 1 }}>
                  {gradePie.map((e) => (
                    <Chip
                      key={e.name}
                      label={`${e.name}: ${e.value}`}
                      size="small"
                      sx={{ bgcolor: `${e.color}1a`, color: e.color, fontWeight: 700, fontSize: 10, height: 20 }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Card>

          {/* GPI trend line */}
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <TrendingUp sx={{ color: "#10b981" }} />
              <Typography variant="subtitle1" fontWeight={700}>Tren GPI</Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : gpiTrend.length < 2 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Data belum mencukupi</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={gpiTrend} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="GPI" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Box>
      </Box>

      {/* ── Radar + Subject detail cards ─────────────────────────────────── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 3fr" }, gap: 2.5, mb: 3 }}>

        {/* Radar */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Analytics sx={{ color: "#7c3aed" }} />
            <Typography variant="h6" fontWeight={700}>Profil Prestasi ({selectedExam})</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : radarData.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data {selectedExam}</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} outerRadius="65%">
                <PolarGrid stroke="#e0e0e0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Markah" dataKey="Markah" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Subject-by-subject card grid */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Assignment sx={{ color: "#f59e0b" }} />
            <Typography variant="h6" fontWeight={700}>Pencapaian Matapelajaran ({selectedExam})</Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
          ) : selSubjects.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Tiada data matapelajaran {selectedExam}</Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)" }, gap: 1.5, maxHeight: 280, overflowY: "auto" }}>
              {selSubjects.map((s, i) => {
                const gradeColor = GRADE_COLOR(s.grade);
                return (
                  <Box key={i} sx={{
                    p: 1.5, borderRadius: 2, border: `1px solid ${gradeColor}40`,
                    bgcolor: `${gradeColor}08`, textAlign: "center",
                  }}>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mb: 0.5 }}>
                      {s.subjectName}
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: gradeColor, lineHeight: 1 }}>
                      {s.grade || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.mark !== null && s.mark !== undefined ? `${s.mark}` : "—"}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Card>
      </Box>


    </Box>
  );
};

export default StudentDashboard;
