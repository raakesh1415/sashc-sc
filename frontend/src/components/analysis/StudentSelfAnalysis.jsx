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
  return "error"; // G
};

const StudentSelfAnalysis = () => {
  const [myData, setMyData] = useState([]);
  const [gpiRow, setGpiRow] = useState(null);
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

  // ── Fetch student self analysis data ───────────────────────────────────────
  const GetData = useCallback(() => {
    if (!selectedExam) {
      setMyData([]);
      setGpiRow(null);
      return;
    }

    setLoading(true);
    setMessage(null);
    
    axiosInstance
      .get(`/analysis-self/?exam=${selectedExam}`)
      .then((res) => {
        const data = res.data.data || [];
        const gpi = res.data.gpi || null;
        const studentStatus = res.data.status || null;
        
        // Add status to GPI row
        if (gpi && studentStatus) {
          gpi.status = studentStatus;
        }
        
        setMyData(data);
        setGpiRow(gpi);
        
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
        setGpiRow(null);
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

  // ── Prepare table data with GPI row ────────────────────────────────────────
  const tableData = useMemo(() => {
    if (gpiRow) {
      return [...myData, gpiRow];
    }
    return myData;
  }, [myData, gpiRow]);

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        header: "Bil",
        accessorFn: (row, index) => {
          if (row.subjectName === "GPI") return "";
          return index + 1;
        },
        id: "bil",
        enableEditing: false,
        enableSorting: false,
        size: 50,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: "subjectName",
        header: "Mata Pelajaran",
        enableEditing: false,
        size: 200,
        Cell: ({ cell, row }) => (
          <Typography 
            variant="body2" 
            fontWeight={row.original.subjectName === "GPI" ? 600 : 400}
          >
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: "mark",
        header: "Markah",
        enableEditing: false,
        size: 120,
        Cell: ({ cell, row }) => {
          const isGPI = row.original.subjectName === "GPI";
          
          // For GPI row, show Status chip
          if (isGPI) {
            const status = row.original.status;
            if (status) {
              return (
                <Chip
                  label={status}
                  size="small"
                  color={status === "LULUS" ? "success" : "error"}
                  sx={{ fontSize: 11, fontWeight: 600, minWidth: 60 }}
                />
              );
            }
            return <Typography variant="body2">—</Typography>;
          }
          
          // For regular rows, show mark
          const mark = cell.getValue();
          return (
            <Typography variant="body2">
              {mark !== null && mark !== undefined ? Math.round(mark) : "—"}
            </Typography>
          );
        },
      },
      {
        accessorKey: "grade",
        header: "Gred",
        enableEditing: false,
        size: 80,
        Cell: ({ cell, row }) => {
          const grade = cell.getValue();
          const isGPI = row.original.subjectName === "GPI";
          
          if (!grade) {
            return <Typography variant="body2">—</Typography>;
          }
          
          if (isGPI) {
            // GPI value shown as bold text
            return (
              <Typography variant="body2" fontWeight={600}>
                {grade}
              </Typography>
            );
          }
          
          // Regular grade shown as chip
          return (
            <Chip
              label={grade}
              size="small"
              color={gradeColor(grade)}
              sx={{ fontSize: 12, minWidth: 30, fontWeight: 500 }}
            />
          );
        },
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
        data={tableData}
        loading={loading}
        enableRowActions={false}
        enablePagination={false}
        enableBottomToolbar={false}
        muiTableBodyRowProps={({ row }) => ({
          sx: {
            backgroundColor: row.original.subjectName === "GPI" ? "#fff3cd" : "inherit",
          },
        })}
        sortingFns={{
          auto: (rowA, rowB, columnId) => {
            if (rowA.original.subjectName === "GPI") return 1;
            if (rowB.original.subjectName === "GPI") return -1;

            const a = rowA.getValue(columnId);
            const b = rowB.getValue(columnId);

            if (a === b) return 0;
            return a > b ? 1 : -1;
          },
        }}
        initialState={{
          sorting: [],
        }}
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

export default StudentSelfAnalysis;