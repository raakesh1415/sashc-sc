import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  BarChart as BarChartIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton } from "../layout/Buttons";
import DialogBox from "../layout/DialogBox";
import AppTable from "../layout/AppTable";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";

const parseApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (typeof data === "object") {
    const msgs = Object.values(data).flatMap((v) =>
      Array.isArray(v) ? v : typeof v === "string" ? [v] : []
    );
    if (msgs.length) return msgs.join(" ");
  }
  return fallback;
};

const ExamAnalysis = () => {
  const [myData, setMyData] = useState([]);
  const [studentSummary, setStudentSummary] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState("TOV");
  const [tempSelectedExam, setTempSelectedExam] = useState("TOV");

  const examOptions = [
    { value: "TOV", label: "TOV" },
    { value: "AR1", label: "AR1" },
    { value: "AR2", label: "AR2" },
    { value: "ETR", label: "ETR" },
  ];

  // ── Fetch analysis data ─────────────────────────────────────────────────────
  const GetData = useCallback(() => {
    if (!selectedExam) {
      setMyData([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    
    axiosInstance
      .get(`/analysis-exam/?exam=${selectedExam}`)
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        setStudentSummary(res.data.studentSummary || null);

        if (data.length === 0) {
          setMessage(
            <MyMessage
              messageText="Tiada data analisis untuk peperiksaan ini"
              messagecolor="orange"
            />
          );
        }
      })
      .catch((err) => {
        setMessage(
          <MyMessage
            messageText={parseApiError(err, "Gagal memuatkan data analisis.")}
            messagecolor="red"
          />
        );
        setMyData([]);
        setStudentSummary(null);
      })
      .finally(() => setLoading(false));
  }, [selectedExam]);

  useEffect(() => {
    GetData();
  }, [GetData]);

  // ── Handle exam selection dialog ────────────────────────────────────────────
  const handleOpenDialog = () => {
    setTempSelectedExam(selectedExam);
    setDialogOpen(true);
  };

  const handleExamConfirm = () => {
    setSelectedExam(tempSelectedExam);
    setDialogOpen(false);
  };

  // ── Calculate GPS (totals) row ─────────────────────────────────────────────
  const totalsRow = useMemo(() => {
    if (myData.length === 0) return null;

    const totals = {
      subjectName: "GPS",
      ambil: 0,
      tidakHadir: 0,
      gradeAPlus: 0,
      gradeA: 0,
      gradeAMinus: 0,
      gradeBPlus: 0,
      gradeB: 0,
      gradeCPlus: 0,
      gradeC: 0,
      gradeD: 0,
      gradeE: 0,
      gradeG: 0,
    };

    myData.forEach((row) => {
      totals.ambil += row.ambil || 0;
      totals.tidakHadir += row.tidakHadir || 0;
      totals.gradeAPlus += row.gradeAPlus || 0;
      totals.gradeA += row.gradeA || 0;
      totals.gradeAMinus += row.gradeAMinus || 0;
      totals.gradeBPlus += row.gradeBPlus || 0;
      totals.gradeB += row.gradeB || 0;
      totals.gradeCPlus += row.gradeCPlus || 0;
      totals.gradeC += row.gradeC || 0;
      totals.gradeD += row.gradeD || 0;
      totals.gradeE += row.gradeE || 0;
      totals.gradeG += row.gradeG || 0;
    });

    // Calculate GPS using the same GPMP formula but with totals
    const gpsNumerator =
        totals.gradeAPlus * 0 +
        totals.gradeA     * 1 +
        totals.gradeAMinus* 2 +
        totals.gradeBPlus * 3 +
        totals.gradeB     * 4 +
        totals.gradeCPlus * 5 +
        totals.gradeC     * 6 +
        totals.gradeD     * 7 +
        totals.gradeE     * 8 +
        totals.gradeG     * 9;
    
    totals.gps = totals.ambil > 0 ? (gpsNumerator / totals.ambil).toFixed(2) : "0.00";
    totals.gagalPersen = totals.ambil > 0 ? ((totals.gradeG / totals.ambil) * 100).toFixed(2) : "0.00";
    
    const lulusBil = totals.gradeAPlus + totals.gradeA + totals.gradeAMinus + totals.gradeBPlus + totals.gradeB + totals.gradeCPlus + totals.gradeC + totals.gradeD + totals.gradeE;
    totals.lulusBil = lulusBil;
    totals.lulusPersen = totals.ambil > 0 ? ((lulusBil / totals.ambil) * 100).toFixed(2) : "0.00";

    return totals;
  }, [myData]);

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        header: "Bil",
        accessorFn: (_, index) => index + 1,
        id: "bil",
        enableEditing: false,
        enableSorting: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2">{cell.getValue()}</Typography>
        ),
      },
      {
        accessorKey: "subjectName",
        header: "Mata Pelajaran",
        enableEditing: false,
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2">{cell.getValue()}</Typography>
        ),
      },
      {
        accessorKey: "ambil",
        header: "Ambil",
        enableEditing: false,
        size: 60,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "tidakHadir",
        header: "TH",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeAPlus",
        header: "A+",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeA",
        header: "A",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeAMinus",
        header: "A-",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeBPlus",
        header: "B+",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeB",
        header: "B",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeCPlus",
        header: "C+",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeC",
        header: "C",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeD",
        header: "D",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeE",
        header: "E",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" >
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeG",
        header: "G",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2"  color="error.main" fontWeight={600}>
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gagalPersen",
        header: "%",
        enableEditing: false,
        size: 60,
        Cell: ({ cell }) => (
          <Typography variant="body2"  color="error.main" fontWeight={600}>
            {cell.getValue() || "0.00"}
          </Typography>
        ),
      },
      {
        accessorKey: "lulusBil",
        header: "Lulus",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2"  color="success.main" fontWeight={600}>
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "lulusPersen",
        header: "%",
        enableEditing: false,
        size: 60,
        Cell: ({ cell }) => (
          <Typography variant="body2"  color="success.main" fontWeight={600}>
            {cell.getValue() || "0.00"}
          </Typography>
        ),
      },
      {
        accessorKey: "gpmp",
        header: "GPMP",
        enableEditing: false,
        size: 70,
        Cell: ({ cell }) => (
          <Typography variant="body2"  fontWeight={600}>
            {cell.getValue() || "0.00"}
          </Typography>
        ),
      },
    ],
    []
  );

  // ── Table data (no GPS row — shown in summary box below) ──────────────────
  const tableData = myData;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        icon={<BarChartIcon sx={{ color: "primary.main" }} />}
        title={`Analisis Peperiksaan - ${selectedExam}`}
      >
        <PrimaryButton startIcon={<AssessmentIcon />} onClick={handleOpenDialog}>
          Peperiksaan - {selectedExam}
        </PrimaryButton>
      </PageHeader>

      {message}

      {/* ── GPS / Student Summary Cards ─────────────────────────────────── */}
      {(totalsRow || studentSummary) && (
        <Box
          sx={{
            mb: 2,
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(6, 1fr)",
            },
            gap: 1.5,
          }}
        >
          {[
            {
              label: "GPS",
              value: totalsRow?.gps ?? "—",
              color: "text.primary",
              bg: "#fff8e1",
              border: "#ffc107",
            },
            {
              label: "Jumlah Pelajar",
              value: studentSummary?.totalStudents ?? "—",
              color: "text.primary",
              bg: "#e3f2fd",
              border: "#42a5f5",
            },
            {
              label: "Bil. Lulus",
              value: studentSummary?.lulusBil ?? "—",
              color: "success.main",
              bg: "#e8f5e9",
              border: "#66bb6a",
            },
            {
              label: "% Lulus",
              value: studentSummary ? `${studentSummary.lulusPersen}%` : "—",
              color: "success.main",
              bg: "#e8f5e9",
              border: "#66bb6a",
            },
            {
              label: "Bil. Gagal",
              value: studentSummary?.gagalBil ?? "—",
              color: "error.main",
              bg: "#ffebee",
              border: "#ef5350",
            },
            {
              label: "% Gagal",
              value: studentSummary ? `${studentSummary.gagalPersen}%` : "—",
              color: "error.main",
              bg: "#ffebee",
              border: "#ef5350",
            },
          ].map((card) => (
            <Box
              key={card.label}
              sx={{
                p: { xs: 1.5, sm: 2 },
                bgcolor: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: 2,
                textAlign: "center",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 0.5, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
              >
                {card.label}
              </Typography>
              <Typography
                fontWeight={700}
                color={card.color}
                sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem", md: "1.5rem" } }}
              >
                {card.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <AppTable
        columns={columns}
        data={tableData}
        loading={loading}
        enableRowActions={false}
        enablePagination={false}
        enableBottomToolbar={false}
      />

      {/* ── Select Exam Dialog ─────────────────────────────────────────────── */}
      <DialogBox
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Pilih Peperiksaan"
        onConfirm={handleExamConfirm}
        maxWidth="xs"
      >
        {selectedExam && (
          <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Peperiksaan semasa: <strong>{selectedExam}</strong>
            </Typography>
          </Box>
        )}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="exam-select-label">Pilih Peperiksaan</InputLabel>
          <Select
            labelId="exam-select-label"
            value={tempSelectedExam}
            label="Pilih Peperiksaan"
            onChange={(e) => setTempSelectedExam(e.target.value)}
          >
            {examOptions.map((exam) => (
              <MenuItem key={exam.value} value={exam.value}>{exam.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogBox>
    </Box>
  );
};

export default ExamAnalysis;