import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Chip,
  InputAdornment,
} from "@mui/material";
import {
  Assignment as AssignmentIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, EditButton, DeleteButton } from "../layout/Buttons";
import DialogBox from "../layout/DialogBox";
import AppTable from "../layout/AppTable";
import BulkUploadDialog from "../layout/BulkUploadDialog";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";

// ── Grade lookup ──────────────────────────────────────────────────────────────
const getGrade = (mark) => {
  if (mark === null || mark === undefined || mark === "") return "";
  const m = Number(mark);
  if (isNaN(m)) return "";
  if (m >= 90) return "A+";
  if (m >= 80) return "A";
  if (m >= 70) return "A-";
  if (m >= 65) return "B+";
  if (m >= 60) return "B";
  if (m >= 55) return "C+";
  if (m >= 50) return "C";
  if (m >= 45) return "D";
  if (m >= 40) return "E";
  return "G";
};

// ── Parse API / DRF error response into a single string ───────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────

const AR1List = () => {
  const [myData, setMyData] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editMark, setEditMark] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete AR1 dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Error shown inside the currently-open dialog
  const [dialogError, setDialogError] = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const GetData = useCallback(() => {
    setLoading(true);
    axiosInstance
      .get("/ar1/")
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        if (data.length === 0) {
          setMessage(<MyMessage key={Date.now()}messageText="Tiada rekod AR1 untuk sesi ini." messagecolor="orange" />);
        }
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()}messageText={parseApiError(err, "Gagal memuatkan data AR1.")} messagecolor="red" />);
        setMyData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    GetData();
  }, [GetData]);

  // ── Open edit dialog ────────────────────────────────────────────────────────
  const handleOpenEdit = (row) => {
    setEditRow(row);
    setDialogError("");
    setEditMark(row.AR1grade === "TH" ? "TH" : (row.AR1mark ?? ""));
    setEditGrade(row.AR1grade ?? "");
    setEditOpen(true);
  };

  // ── Mark change → auto-compute grade ────────────────────────────────────────
  const handleMarkChange = (value) => {
    const upper = value.toUpperCase();
    if (upper === "TH") {
      setEditMark("TH");
      setEditGrade("TH");
    } else {
      setEditMark(value);
      const grade = value === "" ? "" : getGrade(value);
      setEditGrade(grade);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editRow || !editRow.headcountID) return;
    if (editMark !== "" && editMark.toUpperCase() !== "TH") {
      const m = Number(editMark);
      if (isNaN(m)) {
        setDialogError("Markah tidak sah. Sila masukkan nombor antara 0 hingga 100 atau 'TH'.");
        return;
      }
      if (m < 0 || m > 100) {
        setDialogError("Markah mestilah antara 0 hingga 100.");
        return;
      }
    }
    setSaving(true);
    try {
      await axiosInstance.patch(`/ar1/${editRow.headcountID}/`, {
        AR1mark:
          editMark === "" || editMark === "TH" ? null : Number(editMark),
        AR1grade: editGrade === "" ? null : editGrade,
      });
      
      setDialogError("");
      setEditOpen(false);
      GetData();
      setMessage(
        <MyMessage
          key={Date.now()}
          messageText="AR1 berjaya dikemaskini!"
          messagecolor="green"
        />,
      );
    } catch (err) {
      setDialogError(parseApiError(err, "Ralat semasa mengemaskini AR1."));
    } finally {
      setSaving(false);
    }
  };

  // ── Clear AR1 for this specific student-subject ────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteRow || !deleteRow.headcountID) return;
    
    setDeleting(true);
    try {
      await axiosInstance.patch(`/ar1/${deleteRow.headcountID}/`, {
        AR1mark: null,
        AR1grade: null,
      });
      
      setDialogError("");
      setDeleteOpen(false);
      GetData();
      setMessage(
        <MyMessage
          key={Date.now()}
          messageText="AR1 berjaya dipadamkan!"
          messagecolor="green"
        />,
      );
    } catch (err) {
      setDialogError(parseApiError(err, "Ralat semasa memadam AR1."));
    } finally {
      setDeleting(false);
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      header: "Bil",
      accessorFn: (_, index) => index + 1,
      id: "bil",
      enableEditing: false,
      enableSorting: false,
      size: 60,
    },
    {
      accessorKey: "subjectName",
      header: "Subjek",
      enableEditing: false,
      size: 160,
    },
    {
      accessorKey: "studentName",
      header: "Nama Murid",
      enableEditing: false,
      size: 180,
    },
    {
      accessorKey: "className",
      header: "Kelas",
      enableEditing: false,
      size: 80,
      Cell: ({ cell }) => (
        <Typography variant="body2">{cell.getValue() || "—"}</Typography>
      ),
    },
    {
      accessorKey: "AR1mark",
      header: "Markah",
      enableEditing: false,
      size: 90,
      Cell: ({ cell, row }) => {
        const mark = cell.getValue();
        const grade = row.original.AR1grade;
        
        if (mark == null && !grade) {
          return (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          );
        }
        
        if (grade === "TH") {
          return (
            <Typography variant="body2">
              TH
            </Typography>
          );
        }
        
        return (
          <Typography variant="body2">
            {mark != null ? Math.round(mark) : "—"}
          </Typography>
        );
      },
    },
    {
      accessorKey: "AR1grade",
      header: "Gred",
      enableEditing: false,
      size: 90,
      Cell: ({ cell }) => {
        const grade = cell.getValue();
        if (!grade) return <Typography variant="body2">—</Typography>;
        
        return (
          <Chip
            label={grade}
            size="small"
            color={gradeColor(grade)}
            sx={{ fontSize: 12, minWidth: 38, fontWeight: 600 }}
          />
        );
      },
    },
  ], []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader icon={<AssignmentIcon sx={{ color: "primary.main" }} />} title="Peperiksaan AR1">
        <PrimaryButton startIcon={<UploadFileIcon />} onClick={() => setBulkOpen(true)}>
          Muat Naik
        </PrimaryButton>
      </PageHeader>

      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Muat Naik Markah AR1"
        uploadUrl="/ar1/upload-marks/"
        downloadUrl="/ar1/download-marks-template/"
        downloadFileName="template_ar1_markah.xlsx"
        instructions={[
          "Template mengandungi satu baris setiap pelajar bagi mata pelajaran anda.",
          "Isi markah di kolum 'Mark' (0-100), 'TH' untuk Tidak Hadir, atau kosongkan untuk tidak dikemaskini.",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
          "Latar belakang KELABU = maklumat pelajar (Student Name, Class Name, Subject Name). Jangan ubah kolum ini.",
        ]}
        onSuccess={() => {
          GetData();
          setMessage(<MyMessage key={Date.now()}messageText="Markah AR1 berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

      {message}

      <AppTable
        columns={columns}
        data={myData}
        loading={loading}
        renderRowActions={({ row }) => (
          <Box sx={{ display: "flex", gap: 1 }}>
            <EditButton onClick={() => handleOpenEdit(row.original)}>
              Ubah
            </EditButton>
            <DeleteButton
              onClick={() => {
                setDeleteRow(row.original);
                setDialogError("");
                setDeleteOpen(true);
              }}
            >
              Padam
            </DeleteButton>
          </Box>
        )}
      />

      {/* ── Edit AR1 Dialog ─────────────────────────────────────────────────── */}
      <DialogBox
        open={editOpen}
        onClose={() => { setEditOpen(false); setDialogError(""); }}
        title="Kemaskini AR1"
        subtitle={editRow ? `${editRow.studentName} — ${editRow.subjectName}${editRow.className ? ` (${editRow.className})` : ""}` : undefined}
        onConfirm={handleSave}
        loading={saving}
        error={dialogError}
        onClearError={() => setDialogError("")}
        maxWidth="xs"
      >
        <TextField
          fullWidth
          size="medium"
          type="text"
          label="Markah AR1"
          placeholder="0–100 atau TH"
          value={editMark}
          onChange={(e) => handleMarkChange(e.target.value)}
          slotProps={{
            input: {
              endAdornment: editGrade ? (
                <InputAdornment position="end">
                  <Chip
                    label={editGrade}
                    size="small"
                    color={gradeColor(editGrade)}
                    sx={{ fontWeight: 600, minWidth: 38 }}
                  />
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
      </DialogBox>

      {/* ── Delete Confirmation Dialog ───────────────────────────────────────── */}
      <DialogBox
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDialogError(""); }}
        title="Pengesahan Padam"
        variant="delete"
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        error={dialogError}
        onClearError={() => setDialogError("")}
        maxWidth="xs"
      >
        <Typography>
          Adakah anda pasti ingin memadam markah AR1 ini? Tindakan ini tidak boleh dibuat asal.
        </Typography>
        {deleteRow && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Pelajar: <strong>{deleteRow.studentName}</strong>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Subjek: <strong>{deleteRow.subjectName}</strong>
            </Typography>
            {deleteRow.className && (
              <Typography variant="body2" color="textSecondary">
                Kelas: <strong>{deleteRow.className}</strong>
              </Typography>
            )}
          </Box>
        )}
      </DialogBox>
    </Box>
  );
};

export default AR1List;