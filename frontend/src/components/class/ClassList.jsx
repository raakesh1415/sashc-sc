import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  TextField,
} from "@mui/material";
import { useYear } from "../../YearContext";
import {
  AddBox as AddBoxIcon,
  School as SchoolIcon,
  PersonAdd as PersonAddIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import DialogBox from "../layout/DialogBox";
import BulkUploadDialog from "../layout/BulkUploadDialog";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, ViewButton, EditButton, DeleteButton } from "../layout/Buttons";
import AppTable from "../layout/AppTable";
import axiosInstance from "../../AxiosInstance";
import * as yup from "yup";
import MyMessage from "../layout/Message";

const parseApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (typeof data === 'object') {
    const msgs = Object.values(data).flatMap((v) =>
      Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
    );
    if (msgs.length) return msgs.join(' ');
  }
  return fallback;
};

const classSchema = yup.object().shape({
  className: yup
    .string()
    .required("Nama kelas diperlukan")
    .min(2, "Nama kelas mestilah sekurang-kurangnya 2 aksara")
    .max(25, "Nama kelas tidak boleh melebihi 25 aksara")
    .matches(/^[a-zA-Z0-9\s-]+$/, "Huruf, nombor, ruang dan sempang sahaja"),
});

const ClassList = () => {
  const year = useYear();
  const [myData, setMyData]                     = useState([]);
  const [message, setMessage] = useState(null);

  // Edit dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editRow, setEditRow]               = useState(null);
  const [editClassName, setEditClassName]   = useState("");
  const [editError, setEditError]           = useState("");
  const [editLoading, setEditLoading]       = useState(false);

  // Add method selection dialog
  const [openAddMethodDialog, setOpenAddMethodDialog] = useState(false);

  // Single-add dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [addClassName, setAddClassName]   = useState("");
  const [addError, setAddError]           = useState("");
  const [addLoading, setAddLoading]       = useState(false);

  // CSV upload dialog
  const [openBulkDialog, setOpenBulkDialog] = useState(false);

  // Delete dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [rowToDelete, setRowToDelete]           = useState(null);

  // Assign teacher dialog
  const [openAssignDialog, setOpenAssignDialog]   = useState(false);
  const [assignRow, setAssignRow]                 = useState(null);
  const [classTeachers, setClassTeachers]         = useState([]);
  const [selectedTeacherID, setSelectedTeacherID] = useState('');
  const [assignLoading, setAssignLoading]         = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const GetData = () => {
    axiosInstance.get("/classes/")
      .then((res) => {
        const data = (res.data.data || []).sort((a, b) => (a.className || '').localeCompare(b.className || ''));
        setMyData(data);
        if (data.length === 0)
          setMessage(<MyMessage key={Date.now()}messageText="Tiada kelas untuk sesi ini." messagecolor="orange" />);
      })
      .catch(() => setMessage(<MyMessage key={Date.now()}messageText="Gagal memuatkan senarai kelas." messagecolor="red" />));
  };

  const fetchClassTeachers = () => {
    axiosInstance.get("/classes/class-teachers/")
      .then((res) => setClassTeachers(res.data.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    GetData();
    fetchClassTeachers();
  }, []);

  // ── SINGLE ADD ─────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setOpenAddMethodDialog(false);
    setAddClassName("");
    setAddError("");
    setOpenAddDialog(true);
  };

  const handleAddConfirm = async () => {
    try {
      await classSchema.validate({ className: addClassName });
      setAddLoading(true);
      await axiosInstance.post("/classes/", { className: addClassName, year: parseInt(year) });
      setMessage(<MyMessage key={Date.now()}messageText="Kelas berjaya ditambah!" messagecolor="green" />);
      setOpenAddDialog(false);
      GetData();
    } catch (err) {
      if (err.name === 'ValidationError') {
        setAddError(err.message);
      } else {
        const msg = parseApiError(err, "Ralat semasa menambah kelas.");
        setAddError(msg.includes("unique set") ? `Kelas "${addClassName}" sudah wujud dalam tahun ini.` : msg);
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  const handleOpenEdit = (row) => {
    setEditRow(row);
    setEditClassName(row.original.className);
    setEditError("");
    setOpenEditDialog(true);
  };

  const handleEditConfirm = async () => {
    try {
      await classSchema.validate({ className: editClassName });
      setEditLoading(true);
      await axiosInstance.put(`/classes/${editRow.original.classID}/`, {
        className: editClassName,
        year: parseInt(year),
      });
      setMessage(<MyMessage key={Date.now()}messageText="Kelas berjaya dikemaskini!" messagecolor="green" />);
      setOpenEditDialog(false);
      GetData();
    } catch (err) {
      if (err.name === 'ValidationError') {
        setEditError(err.message);
      } else {
        const msg = parseApiError(err, "Ralat semasa mengemaskini kelas.");
        setEditError(msg.includes("unique set") ? `Kelas "${editClassName}" sudah wujud dalam tahun ini.` : msg);
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = () => {
    if (!rowToDelete) return;
    axiosInstance.delete(`/classes/${rowToDelete.original.classID}/`)
      .then(() => {
        setMessage(<MyMessage key={Date.now()}messageText="Kelas berjaya dipadam!" messagecolor="green" />);
        setOpenDeleteDialog(false);
        GetData();
      })
      .catch((err) => setMessage(<MyMessage key={Date.now()}messageText={parseApiError(err, "Gagal memadam kelas.")} messagecolor="red" />));
  };

  // ── ASSIGN TEACHER ─────────────────────────────────────────────────────────
  const handleOpenAssign = (row) => {
    setAssignRow(row);
    setSelectedTeacherID(row.original.currentTeacherUserID || '');
    setOpenAssignDialog(true);
  };

  const handleAssignConfirm = async () => {
    if (!assignRow) return;
    setAssignLoading(true);
    try {
      await axiosInstance.patch(
        `/classes/${assignRow.original.classID}/assign-teacher/`,
        { teacherID: selectedTeacherID || null }
      );
      setMessage(<MyMessage key={Date.now()}messageText="Guru Kelas berjaya ditetapkan!" messagecolor="green" />);
      setOpenAssignDialog(false);
      GetData();
    } catch (err) {
      setMessage(<MyMessage key={Date.now()}messageText={parseApiError(err, "Ralat semasa menetapkan guru.")} messagecolor="red" />);
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      header: "Bil",
      accessorFn: (row, index) => index + 1,
      enableSorting: false,
      enableHiding: true,
      size: 50,
    },
    {
      accessorKey: "className",
      header: "Kelas",
    },
    {
      accessorKey: "teacherName",
      header: "Guru Kelas",
      Cell: ({ cell }) => (
        <Typography variant="body2">{cell.getValue() || "—"}</Typography>
      ),
    },
  ], []);

  const tableRef = useRef(null);

  return (
    <Box>
      <PageHeader icon={<SchoolIcon sx={{ color: "primary.main" }} />} title="Pengurusan Kelas">
        <PrimaryButton startIcon={<AddBoxIcon />} onClick={() => setOpenAddMethodDialog(true)}>
          Tambah Kelas
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        ref={tableRef}
        columns={columns}
        data={myData}
        actionsColumnSize={260}
        renderRowActions={({ row }) => (
          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <ViewButton startIcon={<PersonAddIcon />} onClick={() => handleOpenAssign(row)}>Tetap</ViewButton>
            <EditButton onClick={() => handleOpenEdit(row)}>Ubah</EditButton>
            <DeleteButton onClick={() => { setRowToDelete(row); setOpenDeleteDialog(true); }}>Padam</DeleteButton>
          </Box>
        )}
      />

      {/* ── Add Method Selection Dialog ───────────────────────────────────── */}
      <DialogBox
        open={openAddMethodDialog}
        onClose={() => setOpenAddMethodDialog(false)}
        title="Pilih Kaedah Tambah Kelas"
        variant="none"
      >
        <Stack spacing={2}>
          <PrimaryButton startIcon={<AddBoxIcon />} onClick={handleOpenAdd} fullWidth sx={{ py: 2 }}>
            Tambah Satu Kelas
          </PrimaryButton>
          <EditButton
            startIcon={<UploadFileIcon />}
            onClick={() => { setOpenAddMethodDialog(false); setOpenBulkDialog(true); }}
            fullWidth
            sx={{ py: 2, minWidth: "unset", height: "unset", fontSize: 14 }}
          >
            Muat Naik Kelas
          </EditButton>
        </Stack>
      </DialogBox>

      {/* ── Single Add Dialog ─────────────────────────────────────────────── */}
      <DialogBox
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        title="Tambah Kelas Baru"
        onConfirm={handleAddConfirm}
        loading={addLoading}
        maxWidth="xs"
      >
        <TextField
          label="Nama Kelas"
          value={addClassName}
          onChange={(e) => { setAddClassName(e.target.value); setAddError(""); }}
          error={!!addError}
          helperText={addError}
          fullWidth
          autoFocus
          required
          onKeyDown={(e) => { if (e.key === "Enter") handleAddConfirm(); }}
        />
      </DialogBox>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <DialogBox
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        title="Kemaskini Kelas"
        onConfirm={handleEditConfirm}
        loading={editLoading}
        maxWidth="xs"
      >
        <TextField
          label="Nama Kelas"
          value={editClassName}
          onChange={(e) => { setEditClassName(e.target.value); setEditError(""); }}
          error={!!editError}
          helperText={editError}
          fullWidth
          autoFocus
          required
          onKeyDown={(e) => { if (e.key === "Enter") handleEditConfirm(); }}
        />
      </DialogBox>

      {/* ── Bulk Upload Dialog ────────────────────────────────────────────── */}
      <BulkUploadDialog
        open={openBulkDialog}
        onClose={() => setOpenBulkDialog(false)}
        title="Muat Naik Kelas Secara Pukal"
        uploadUrl="/classes/bulk-upload/"
        downloadUrl="/classes/download-template/"
        downloadFileName="template_kelas.xlsx"
        instructions={[
          "Isi nama kelas dalam kolum 'Class Name'. Setiap baris mewakili satu kelas.",
          "Contoh: 5 ADHARA, 5 SIRIUS, 5 ORIAN.",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
        ]}
        onSuccess={() => {
          GetData();
          setMessage(<MyMessage key={Date.now()} messageText="Kelas berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

      {/* ── Assign Teacher Dialog ─────────────────────────────────────────── */}
      <DialogBox
        open={openAssignDialog}
        onClose={() => setOpenAssignDialog(false)}
        title="Tetapkan Guru Kelas"
        onConfirm={handleAssignConfirm}
        loading={assignLoading}
        maxWidth="xs"
      >
        {assignRow && (
          <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Kelas: <strong>{assignRow.original.className}</strong>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Guru semasa: <strong>{assignRow.original.teacherName || "—"}</strong>
            </Typography>
          </Box>
        )}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="teacher-select-label">Pilih Guru Kelas</InputLabel>
          <Select
            labelId="teacher-select-label"
            value={selectedTeacherID}
            label="Pilih Guru Kelas"
            onChange={(e) => setSelectedTeacherID(e.target.value)}
          >
            <MenuItem value=""><em>— Tiada Guru —</em></MenuItem>
            {classTeachers.map((t) => (
              <MenuItem key={t.userID} value={t.userID}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogBox>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <DialogBox
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        title="Pengesahan Padam"
        variant="delete"
        onConfirm={handleDeleteConfirm}
        maxWidth="xs"
      >
        <Typography>Adakah anda pasti ingin memadam item ini? Tindakan ini tidak boleh dibuat asal.</Typography>
        {rowToDelete && (
          <Box sx={{ mt: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Kelas: <strong>{rowToDelete.original.className}</strong>
            </Typography>
          </Box>
        )}
      </DialogBox>
    </Box>
  );
};

export default ClassList;
