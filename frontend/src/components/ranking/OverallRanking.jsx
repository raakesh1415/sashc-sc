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
  EmojiEvents as TrophyIcon,
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

const OverallRanking = () => {
  const [myData, setMyData] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState("TOV");
  const [tempSelectedExam, setTempSelectedExam] = useState("TOV");
  const [sorting, setSorting] = useState([{ id: 'ranking', desc: false }]);

  const examOptions = [
    { value: "TOV", label: "TOV" },
    { value: "AR1", label: "AR1" },
    { value: "AR2", label: "AR2" },
    { value: "ETR", label: "ETR" },
  ];

  const GetData = useCallback(() => {
    if (!selectedExam) {
      setMyData([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    
    axiosInstance
      .get(`/ranking-overall/?exam=${selectedExam}`)
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        
        if (data.length === 0) {
          setMessage(
            <MyMessage
              messageText="Tiada data kedudukan untuk peperiksaan ini"
              messagecolor="orange"
            />
          );
        }
      })
      .catch((err) => {
        setMessage(
          <MyMessage
            messageText={parseApiError(err, "Gagal memuatkan data kedudukan.")}
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

  const handleOpenDialog = () => {
    setTempSelectedExam(selectedExam);
    setDialogOpen(true);
  };

  const handleExamConfirm = () => {
    setSelectedExam(tempSelectedExam);
    setDialogOpen(false);
  };

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
        header: "Nama",
        enableEditing: false,
        enableSorting: true,
        size: 200,
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
        enableSorting: true,
        size: 80,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue() || "—"}
          </Typography>
        ),
      },
      {
        accessorKey: "gpi",
        header: "GPI",
        enableEditing: false,
        enableSorting: true,
        size: 80,
        sortingFn: "alphanumeric",
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600}>
            {cell.getValue() || "0.00"}
          </Typography>
        ),
      },
            {
        accessorKey: "status",
        header: "Status",
        enableEditing: false,
        enableSorting: true,
        size: 100,
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
        accessorKey: "ranking",
        header: "Kedudukan",
        enableEditing: false,
        enableSorting: true,
        size: 120,
        sortingFn: "alphanumeric",
        Cell: ({ cell }) => {
          const ranking = cell.getValue();
          const isTopThree = ranking <= 3;
          
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography 
                variant="body2" 
                fontWeight={isTopThree ? 700 : 400}
                color={isTopThree ? "primary.main" : "text.primary"}
              >
                {ranking}
              </Typography>
              {isTopThree && (
                <TrophyIcon
                  sx={{
                    color: ranking === 1 ? "#f0cc00" : ranking === 2 ? "#919191" : "#cd7f32",
                    fontSize: 20
                  }}
                />
              )}
            </Box>
          );
        },
      },
    ],
    []
  );

  return (
    <Box>
      <PageHeader
        icon={<TrophyIcon sx={{ color: "primary.main" }} />}
        title={`Kedudukan Keseluruhan - ${selectedExam}`}
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
        state={{ sorting }}
        onSortingChange={setSorting}
        muiTableBodyRowProps={({ row }) => {
          const isSortedByRanking = sorting.length > 0 && (sorting[0].id === 'ranking' || sorting[0].id === 'gpi');
          return {
            sx: {
              backgroundColor: isSortedByRanking
                ? row.original.ranking === 1 ? "#fff9e6"
                : row.original.ranking === 2 ? "#e8edf2"
                : row.original.ranking === 3 ? "#fff4e6"
                : "inherit"
                : "inherit",
            },
          };
        }}
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

export default OverallRanking;