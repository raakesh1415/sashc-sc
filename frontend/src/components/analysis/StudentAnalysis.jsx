import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import {
  Person as PersonIcon,
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

// ── Grade → chip colour ───────────────────────────────────────────────────────
const gradeColor = (grade) => {
  if (!grade) return "default";
  if (grade === "TH") return "default";
  if (["A+", "A", "A-"].includes(grade)) return "success";
  if (["B+", "B", "C+", "C"].includes(grade)) return "info";
  if (["D+", "D", "E"].includes(grade)) return "warning";
  return "error";
};

const StudentAnalysis = () => {
  const [myData, setMyData] = useState([]);
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

  // ── Fetch student analysis data ────────────────────────────────────────────
  const GetData = useCallback(() => {
    if (!selectedExam) {
      setMyData([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    
    axiosInstance
      .get(`/analysis-student/?exam=${selectedExam}`)
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        
        if (data.length === 0) {
          setMessage(
            <MyMessage
              messageText="Tiada data analisis pelajar untuk peperiksaan ini"
              messagecolor="orange"
            />
          );
        }
      })
      .catch((err) => {
        setMessage(
          <MyMessage
            messageText={parseApiError(err, "Gagal memuatkan data analisis pelajar.")}
            messagecolor="red"
          />
        );
        setMyData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedExam]);

  useEffect(() => {
    GetData();
  }, [GetData]);

  // ── Handle exam selection dialog ───────────────────────────────────────────
  const handleOpenDialog = () => {
    setTempSelectedExam(selectedExam);
    setDialogOpen(true);
  };

  const handleExamConfirm = () => {
    setSelectedExam(tempSelectedExam);
    setDialogOpen(false);
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        header: "Bil",
        accessorFn: (_, index) => index + 1,
        id: "bil",
        enableEditing: false,
        enableSorting: false,
        size: 50,
      },
      {
        accessorKey: "studentName",
        header: "Nama Pelajar",
        enableEditing: false,
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: "className",
        header: "Kelas",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue() || "—"}
          </Typography>
        ),
      },
      {
        accessorKey: "totalSubjects",
        header: "Subjek",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
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
          <Typography variant="body2">
            {cell.getValue() || 0}
          </Typography>
        ),
      },
            {
        accessorKey: "gradeTH",
        header: "TH",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue() || 0}
          </Typography>
        ),
      },
      {
        accessorKey: "gradeSummary",
        header: "Gred Pencapaian",
        enableEditing: false,
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue() || "—"}
          </Typography>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => {
          const status = cell.getValue();
          return (
            <Chip
              label={status}
              size="small"
              color={status === "LULUS" ? "success" : "error"}
              sx={{ fontSize: 11, fontWeight: 600, minWidth: 60 }}
            />
          );
        },
      },
      {
        accessorKey: "gpi",
        header: "GPI",
        enableEditing: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600}>
            {cell.getValue() || "0.00"}
          </Typography>
        ),
      },
    ],
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        icon={<PersonIcon sx={{ color: "primary.main" }} />}
        title={`Analisis Pelajar - ${selectedExam}`}
      >
        <PrimaryButton startIcon={<AssessmentIcon />} onClick={handleOpenDialog}>
          Peperiksaan - {selectedExam}
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        columns={columns}
        data={myData}
        loading={loading}
        enableRowActions={false}
      />

      {/* ── Select Exam Dialog ────────────────────────────────────────────── */}
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

export default StudentAnalysis;