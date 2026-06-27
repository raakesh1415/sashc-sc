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
  // DRF field-level errors: { fieldName: ["msg", ...] }
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

const TOVList = () => {
  const [myData, setMyData] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete TOV dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Error shown inside the currently-open dialog
  const [dialogError, setDialogError] = useState("");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const GetData = useCallback(() => {
    setLoading(true);
    axiosInstance
      .get("/tov/")
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        if (data.length === 0) {
          setMessage(<MyMessage key={Date.now()}messageText="Tiada rekod TOV untuk sesi ini." messagecolor="orange" />);
        }
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()}messageText={parseApiError(err, "Gagal memuatkan data TOV.")} messagecolor="red" />);
        setMyData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    GetData();
  }, [GetData]);

  // ── All unique subjects for table columns ───────────────────────────────────
  // With new SubjectEnrollment model, subjects come from the enrollments array
  const allSubjects = useMemo(() => {
    const map = new Map();
    myData.forEach((student) => {
      student.subjects.forEach((s) => {
        if (!map.has(s.subjectID)) {
          map.set(s.subjectID, {
            subjectID: s.subjectID,
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.subjectCode || '').localeCompare(b.subjectCode || '')
    );
  }, [myData]);

  // ── Open edit dialog ────────────────────────────────────────────────────────
  const handleOpenEdit = (row) => {
    setEditRow(row);
    setDialogError("");
    const init = {};
    row.subjects.forEach((s) => {
      if (s.headcountID) {
        init[s.headcountID] = {
          TOVmark: s.TOVgrade === "TH" ? "TH" : (s.TOVmark ?? ""),
          TOVgrade: s.TOVgrade ?? "",
        };
      }
    });
    setEditValues(init);
    setEditOpen(true);
  };

  // ── Mark change → auto-compute grade (typing "TH" sets grade TH) ────────────
  const handleMarkChange = (headcountID, value) => {
    const upper = value.toUpperCase();
    if (upper === "TH") {
      setEditValues((prev) => ({
        ...prev,
        [headcountID]: { TOVmark: "TH", TOVgrade: "TH" },
      }));
    } else {
      const grade = value === "" ? "" : getGrade(value);
      setEditValues((prev) => ({
        ...prev,
        [headcountID]: { TOVmark: value, TOVgrade: grade },
      }));
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Validate all marks before sending to API
    for (const vals of Object.values(editValues)) {
      const mark = String(vals.TOVmark ?? "");
      if (mark !== "" && mark.toUpperCase() !== "TH") {
        const m = Number(mark);
        if (isNaN(m)) {
          setDialogError("Markah tidak sah. Sila masukkan nombor antara 0 hingga 100 atau 'TH'.");
          return;
        }
        if (m < 0 || m > 100) {
          setDialogError("Markah mestilah antara 0 hingga 100.");
          return;
        }
      }
    }
    setSaving(true);
    try {
      const patches = Object.entries(editValues).map(([hcID, vals]) =>
        axiosInstance.patch(`/tov/${hcID}/`, {
          TOVmark:
            vals.TOVmark === "" || vals.TOVmark === "TH"
              ? null
              : Number(vals.TOVmark),
          TOVgrade: vals.TOVgrade === "" ? null : vals.TOVgrade,
        }),
      );
      await Promise.all(patches);
      setDialogError("");
      setEditOpen(false);
      GetData();
      setMessage(
        <MyMessage
          key={Date.now()}
          messageText="TOV berjaya dikemaskini!"
          messagecolor="green"
        />,
      );
    } catch (err) {
      setDialogError(parseApiError(err, "Ralat semasa mengemaskini TOV."));
    } finally {
      setSaving(false);
    }
  };

  // ── Clear all TOV for a student ────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await axiosInstance.patch(`/tov/${deleteRow.userID}/clear/`);
      setDialogError("");
      setDeleteOpen(false);
      GetData();
      setMessage(
        <MyMessage
          key={Date.now()}
          messageText="TOV berjaya dipadamkan!"
          messagecolor="green"
        />,
      );
    } catch (err) {
      setDialogError(parseApiError(err, "Ralat semasa memadam TOV."));
    } finally {
      setDeleting(false);
    }
  };

  // ── Subject map helper ──────────────────────────────────────────────────────
  const getSubjectMap = (student) => {
    const map = {};
    student.subjects.forEach((s) => {
      map[s.subjectID] = s;
    });
    return map;
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const fixed = [
      {
        header: "Bil",
        accessorFn: (_, index) => index + 1,
        id: "bil",
        enableEditing: false,
        enableSorting: false,
        enableHiding: true,
        size: 50,
      },
      {
        accessorKey: "name",
        header: "Nama",
        enableEditing: false,
        size: 200,
      },
      {
        accessorKey: "className",
        header: "Kelas",
        enableEditing: false,
        size: 100,
        Cell: ({ cell }) => (
          <Typography variant="body2">{cell.getValue() || "—"}</Typography>
        ),
      },
    ];

    const subjectCols = allSubjects.map((subj) => ({
      id: subj.subjectID,
      header: subj.subjectCode,
      enableEditing: false,
      enableSorting: true,
      size: 100,
      Cell: ({ row }) => {
        const s = getSubjectMap(row.original)[subj.subjectID];
        if (!s)
          return (
            <Typography variant="body2" color="text.disabled">
              
            </Typography>
          );
        if (s.TOVmark == null && !s.TOVgrade)
          return (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          );
        if (s.TOVgrade === "TH")
          return (
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              <Chip
                label="TH"
                size="small"
                color={gradeColor("TH")}
                sx={{ fontSize: 12, minWidth: 30, fontWeight: 500 }}
              />
            </Typography>
          );
        return (
          <Typography variant="body2">
            {s.TOVmark != null ? `${Math.round(s.TOVmark)} ` : ""}
            {s.TOVgrade ? (
              <Chip
                label={s.TOVgrade}
                size="small"
                color={gradeColor(s.TOVgrade)}
                sx={{ fontSize: 12, minWidth: 30, fontWeight: 500 }}
              />
            ) : (
              ""
            )}
          </Typography>
        );
      },
    }));

    return [...fixed, ...subjectCols];
  }, [allSubjects]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader icon={<AssignmentIcon sx={{ color: "primary.main" }} />} title="Peperiksaan TOV">
        <PrimaryButton startIcon={<UploadFileIcon />} onClick={() => setBulkOpen(true)}>
          Muat Naik
        </PrimaryButton>
      </PageHeader>

      <BulkUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Muat Naik Markah TOV"
        uploadUrl="/tov/upload-marks/"
        downloadUrl="/tov/download-marks-template/"
        downloadFileName="template_tov_markah.xlsx"
        instructions={[
          "Template mengandungi satu baris setiap pelajar. Setiap lajur mata pelajaran mengandungi markah semasa.",
          "Isi markah di bawah lajur kod mata pelajaran berkenaan (0-100), 'TH' untuk Tidak Hadir, atau kosongkan untuk tidak dikemaskini.",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
          "Latar belakang KELABU = maklumat pelajar (Student Name, Class Name). Jangan ubah kolum ini.",
        ]}
        onSuccess={() => {
          GetData();
          setMessage(<MyMessage key={Date.now()}messageText="Markah TOV berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

      {message}

      <AppTable
        columns={columns}
        data={myData}
        loading={loading}
        actionsColumnSize={130}
        renderRowActions={({ row }) => (
          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <EditButton onClick={() => handleOpenEdit(row.original)}>Ubah</EditButton>
            <DeleteButton onClick={() => { setDeleteRow(row.original); setDialogError(""); setDeleteOpen(true); }}>Padam</DeleteButton>
          </Box>
        )}
      />

      {/* ── Edit TOV Dialog ─────────────────────────────────────────────────── */}
      <DialogBox
        open={editOpen}
        onClose={() => { setEditOpen(false); setDialogError(""); }}
        title="Kemaskini TOV"
        subtitle={editRow ? `${editRow.name}${editRow.className ? ` — ${editRow.className}` : ""}` : undefined}
        onConfirm={handleSave}
        loading={saving}
        error={dialogError}
        onClearError={() => setDialogError("")}
        maxWidth="md"
      >
        {editRow && editRow.subjects.length === 0 && (
          <Typography color="text.secondary">
            Tiada mata pelajaran didaftarkan.
          </Typography>
        )}
        {editRow && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {editRow.subjects.map((s) => {
              const hcID = s.headcountID;
              const mark = hcID ? (editValues[hcID]?.TOVmark ?? "") : "";
              const grade = hcID ? (editValues[hcID]?.TOVgrade ?? "") : "";
              return (
                <TextField
                  key={s.subjectID}
                  fullWidth
                  size="medium"
                  type="text"
                  label={s.subjectCode ? `${s.subjectCode} — ${s.subjectName}` : s.subjectName}
                  placeholder="0–100 atau TH"
                  value={mark}
                  onChange={(e) => handleMarkChange(hcID, e.target.value)}
                  disabled={!hcID}
                  slotProps={{
                    input: {
                      endAdornment: grade ? (
                        <InputAdornment position="end">
                          <Chip
                            label={grade}
                            size="small"
                            color={gradeColor(grade)}
                            sx={{ fontWeight: 600, minWidth: 38 }}
                          />
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              );
            })}
          </Box>
        )}
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
          Adakah anda pasti ingin memadam item ini? Tindakan ini tidak boleh dibuat asal.
        </Typography>
        {deleteRow && (
          <Box sx={{ mt: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Pelajar: <strong>{deleteRow.name}</strong>
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

export default TOVList;