import React, { useEffect, useMemo, useState, useRef } from "react";
import { Box, Typography, Stack, TextField } from "@mui/material";
import { useYear } from "../../YearContext";
import {
  AddBox as AddBoxIcon,
  MenuBook as MenuBookIcon,
  UploadFile as UploadFileIcon,
} from "@mui/icons-material";
import DialogBox from "../layout/DialogBox";
import BulkUploadDialog from "../layout/BulkUploadDialog";
import AppTable from "../layout/AppTable";
import axiosInstance from "../../AxiosInstance";
import * as yup from "yup";
import MyMessage from "../layout/Message";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, EditButton, DeleteButton } from "../layout/Buttons";

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

const subjectSchema = yup.object().shape({
  subjectCode: yup
    .string()
    .required("Kod mata pelajaran diperlukan")
    .max(20, "Kod mata pelajaran tidak boleh melebihi 20 aksara")
    .matches(/^[a-zA-Z0-9-]+$/, "Huruf, nombor dan sempang sahaja dibenarkan"),
  subjectName: yup
    .string()
    .required("Nama mata pelajaran diperlukan")
    .min(3, "Nama mata pelajaran mestilah sekurang-kurangnya 3 aksara")
    .max(100, "Nama mata pelajaran tidak boleh melebihi 100 aksara")
    .matches(/^[a-zA-Z0-9\s]+$/, "Huruf, nombor dan ruang sahaja dibenarkan"),
});

const SubjectList = () => {
  const year = useYear();
  const [myData, setMyData]                     = useState([]);
  const [message, setMessage]                   = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [rowToDelete, setRowToDelete]           = useState(null);

  // Edit dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editRow, setEditRow]               = useState(null);
  const [editCode, setEditCode]             = useState("");
  const [editName, setEditName]             = useState("");
  const [editErrors, setEditErrors]         = useState({});
  const [editLoading, setEditLoading]       = useState(false);

  // Add method selection dialog
  const [openAddMethodDialog, setOpenAddMethodDialog] = useState(false);

  // Single-add dialog
  const [openAddDialog, setOpenAddDialog]   = useState(false);
  const [addCode, setAddCode]               = useState("");
  const [addName, setAddName]               = useState("");
  const [addErrors, setAddErrors]           = useState({});
  const [addLoading, setAddLoading]         = useState(false);

  // CSV upload dialog
  const [openBulkDialog, setOpenBulkDialog] = useState(false);

  const GetData = () => {
    axiosInstance.get("/subjects/")
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        if (data.length === 0)
          setMessage(<MyMessage key={Date.now()}messageText="Tiada mata pelajaran untuk sesi ini." messagecolor="orange" />);
      })
      .catch(() => setMessage(<MyMessage key={Date.now()}messageText="Gagal memuatkan senarai mata pelajaran." messagecolor="red" />));
  };

  useEffect(() => { GetData(); }, []);

  // ── SINGLE ADD ─────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setOpenAddMethodDialog(false);
    setAddCode("");
    setAddName("");
    setAddErrors({});
    setOpenAddDialog(true);
  };

  const handleAddConfirm = async () => {
    try {
      await subjectSchema.validate({ subjectCode: addCode, subjectName: addName }, { abortEarly: false });
      setAddLoading(true);
      await axiosInstance.post("/subjects/", {
        subjectCode: addCode,
        subjectName: addName,
        year: parseInt(year),
      });
      setMessage(<MyMessage key={Date.now()}messageText="Mata pelajaran berjaya ditambah!" messagecolor="green" />);
      setOpenAddDialog(false);
      GetData();
    } catch (err) {
      if (err.inner) {
        const errs = {};
        err.inner.forEach((e) => { if (!errs[e.path]) errs[e.path] = e.message; });
        setAddErrors(errs);
      } else {
        const msg = parseApiError(err, "Ralat semasa menambah mata pelajaran.");
        setAddErrors({ subjectName: msg.includes("unique set") ? `Mata pelajaran "${addName}" sudah wujud dalam tahun ini.` : msg });
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  const handleOpenEdit = (row) => {
    setEditRow(row);
    setEditCode(row.original.subjectCode || "");
    setEditName(row.original.subjectName);
    setEditErrors({});
    setOpenEditDialog(true);
  };

  const handleEditConfirm = async () => {
    try {
      await subjectSchema.validate({ subjectCode: editCode, subjectName: editName }, { abortEarly: false });
      setEditLoading(true);
      await axiosInstance.put(`/subjects/${editRow.original.subjectID}/`, {
        subjectCode: editCode,
        subjectName: editName,
        year: parseInt(year),
      });
      setMessage(<MyMessage key={Date.now()}messageText="Mata pelajaran berjaya dikemaskini!" messagecolor="green" />);
      setOpenEditDialog(false);
      GetData();
    } catch (err) {
      if (err.inner) {
        const errs = {};
        err.inner.forEach((e) => { if (!errs[e.path]) errs[e.path] = e.message; });
        setEditErrors(errs);
      } else {
        const msg = parseApiError(err, "Ralat semasa mengemaskini mata pelajaran.");
        setEditErrors({ subjectName: msg.includes("unique set") ? `Mata pelajaran "${editName}" sudah wujud dalam tahun ini.` : msg });
      }
    } finally {
      setEditLoading(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = () => {
    if (!rowToDelete) return;
    axiosInstance.delete(`/subjects/${rowToDelete.original.subjectID}/`)
      .then(() => {
        setMessage(<MyMessage key={Date.now()}messageText="Mata pelajaran berjaya dipadam!" messagecolor="green" />);
        setOpenDeleteDialog(false);
        GetData();
      })
      .catch((err) => setMessage(<MyMessage key={Date.now()}messageText={parseApiError(err, "Gagal memadam mata pelajaran.")} messagecolor="red" />));
  };

  const columns = useMemo(() => [
    {
      header: "Bil",
      accessorFn: (row, index) => index + 1,
      enableSorting: false,
      enableHiding: true,
      size: 50,
    },
    {
      accessorKey: "subjectCode",
      header: "Kod",
      size: 120,
      Cell: ({ cell }) => (
        <Typography variant="body2">{cell.getValue() || "—"}</Typography>
      ),
    },
    {
      accessorKey: "subjectName",
      header: "Mata Pelajaran",
    },
  ], []);

  const tableRef = useRef(null);

  return (
    <Box>
      <PageHeader icon={<MenuBookIcon sx={{ color: "primary.main" }} />} title="Pengurusan Mata Pelajaran">
        <PrimaryButton startIcon={<AddBoxIcon />} onClick={() => setOpenAddMethodDialog(true)}>
          Tambah Mata Pelajaran
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        ref={tableRef}
        columns={columns}
        data={myData}
        renderRowActions={({ row }) => (
          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <EditButton onClick={() => handleOpenEdit(row)}>Ubah</EditButton>
            <DeleteButton onClick={() => { setRowToDelete(row); setOpenDeleteDialog(true); }}>Padam</DeleteButton>
          </Box>
        )}
      />

      {/* ── Add Method Selection Dialog ───────────────────────────────────── */}
      <DialogBox
        open={openAddMethodDialog}
        onClose={() => setOpenAddMethodDialog(false)}
        title="Pilih Kaedah Tambah Mata Pelajaran"
        variant="none"
      >
        <Stack spacing={2}>
          <PrimaryButton startIcon={<AddBoxIcon />} onClick={handleOpenAdd} fullWidth sx={{ py: 2 }}>
            Tambah Satu Mata Pelajaran
          </PrimaryButton>
          <EditButton
            startIcon={<UploadFileIcon />}
            onClick={() => { setOpenAddMethodDialog(false); setOpenBulkDialog(true); }}
            fullWidth
            sx={{ py: 2, minWidth: "unset", height: "unset", fontSize: 14 }}
          >
            Muat Naik Mata Pelajaran
          </EditButton>
        </Stack>
      </DialogBox>

      {/* ── Single Add Dialog ─────────────────────────────────────────────── */}
      <DialogBox
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        title="Tambah Mata Pelajaran Baru"
        onConfirm={handleAddConfirm}
        loading={addLoading}
        maxWidth="xs"
      >
        <Stack spacing={2}>
          <TextField
            label="Kod Mata Pelajaran"
            value={addCode}
            onChange={(e) => { setAddCode(e.target.value); setAddErrors((p) => ({ ...p, subjectCode: undefined })); }}
            error={!!addErrors.subjectCode}
            helperText={addErrors.subjectCode}
            fullWidth
            required
            autoFocus
            placeholder="Contoh: BM, BI, MT"
          />
          <TextField
            label="Nama Mata Pelajaran"
            value={addName}
            onChange={(e) => { setAddName(e.target.value); setAddErrors((p) => ({ ...p, subjectName: undefined })); }}
            error={!!addErrors.subjectName}
            helperText={addErrors.subjectName}
            fullWidth
            required
            onKeyDown={(e) => { if (e.key === "Enter") handleAddConfirm(); }}
          />
        </Stack>
      </DialogBox>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <DialogBox
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        title="Kemaskini Mata Pelajaran"
        onConfirm={handleEditConfirm}
        loading={editLoading}
        maxWidth="xs"
      >
        <Stack spacing={2}>
          <TextField
            label="Kod Mata Pelajaran"
            value={editCode}
            onChange={(e) => { setEditCode(e.target.value); setEditErrors((p) => ({ ...p, subjectCode: undefined })); }}
            error={!!editErrors.subjectCode}
            helperText={editErrors.subjectCode}
            fullWidth
            required
            autoFocus
            placeholder="Contoh: BM, BI, MT"
          />
          <TextField
            label="Nama Mata Pelajaran"
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setEditErrors((p) => ({ ...p, subjectName: undefined })); }}
            error={!!editErrors.subjectName}
            helperText={editErrors.subjectName}
            fullWidth
            required
            onKeyDown={(e) => { if (e.key === "Enter") handleEditConfirm(); }}
          />
        </Stack>
      </DialogBox>

      {/* ── Bulk Upload Dialog ────────────────────────────────────────────── */}
      <BulkUploadDialog
        open={openBulkDialog}
        onClose={() => setOpenBulkDialog(false)}
        title="Muat Naik Mata Pelajaran Secara Pukal"
        uploadUrl="/subjects/bulk-upload/"
        downloadUrl="/subjects/download-template/"
        downloadFileName="template_mata_pelajaran.xlsx"
        instructions={[
          "Isi kod dan nama mata pelajaran mengikut format template.",
          "Kedua-dua kolum 'Subject Code' dan 'Subject Name' adalah wajib diisi.",
          "Contoh: BM, BAHASA MELAYU",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
        ]}
        onSuccess={() => {
          GetData();
          setMessage(<MyMessage key={Date.now()} messageText="Mata pelajaran berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

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
            {rowToDelete.original.subjectCode && (
              <Typography variant="body2" color="textSecondary">
                Kod: <strong>{rowToDelete.original.subjectCode}</strong>
              </Typography>
            )}
            <Typography variant="body2" color="textSecondary">
              Mata Pelajaran: <strong>{rowToDelete.original.subjectName}</strong>
            </Typography>
          </Box>
        )}
      </DialogBox>
    </Box>
  );
};

export default SubjectList;
