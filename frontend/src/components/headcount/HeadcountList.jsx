import React, { useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  PieChart as PieChartIcon,
  Category as CategoryIcon,
  Calculate as CalculateIcon,
} from "@mui/icons-material";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton } from "../layout/Buttons";
import DialogBox from "../layout/DialogBox";
import AppTable from "../layout/AppTable";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";
import { AuthContext } from "../../AuthProvider";

const gradeColor = (grade) => {
  if (!grade) return "default";
  if (grade === "TH") return "default";
  if (["A+", "A", "A-"].includes(grade)) return "success";
  if (["B+", "B", "C+", "C"].includes(grade)) return "info";
  if (["D+", "D", "E"].includes(grade)) return "warning";
  return "error";
};

const OTI_METHODS = [
  { value: "formula", label: "Guna Formula" },
  { value: "ai",      label: "Guna AI" },
];

const HeadcountList = () => {
  const { userRoles } = useContext(AuthContext);
  const isSubjectTeacher     = userRoles.includes("Subject Teacher");
  const isSubjectTeacherOnly = userRoles.includes("Subject Teacher") && !userRoles.includes("Admin");

  const [myData, setMyData]                     = useState([]);
  const [message, setMessage]                   = useState(null);
  const [loading, setLoading]                   = useState(false);
  const [subjectsList, setSubjectsList]         = useState([]);
  const [teacherSubjectIDs, setTeacherSubjectIDs] = useState(new Set());
  const [selectedSubjectID, setSelectedSubjectID] = useState("");
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [tempSelectedSubjectID, setTempSelectedSubjectID] = useState("");

  const [otiDialogOpen, setOtiDialogOpen] = useState(false);
  const [otiMethod, setOtiMethod]         = useState("formula");
  const [otiLoading, setOtiLoading]       = useState(false);

  const autoCalcDoneRef = useRef(false);

  const dropdownSubjects = isSubjectTeacherOnly
    ? subjectsList.filter((s) => teacherSubjectIDs.has(s.subjectID))
    : subjectsList;

  const canCalculateOTI = isSubjectTeacher && teacherSubjectIDs.has(selectedSubjectID);

  useEffect(() => {
    const allSubjectsReq = axiosInstance.get("/subjects/");
    const mySubjectsReq  = isSubjectTeacher
      ? axiosInstance.get("/headcount/my-subjects/")
      : Promise.resolve({ data: { data: [] } });

    Promise.all([allSubjectsReq, mySubjectsReq])
      .then(([allRes, myRes]) => {
        const all      = allRes.data.data || [];
        const mySubjs  = myRes.data.data  || [];
        const myIDs    = new Set(mySubjs.map((s) => s.subjectID));

        setSubjectsList(all);
        setTeacherSubjectIDs(myIDs);

        if (!selectedSubjectID) {
          const initialList = (isSubjectTeacherOnly)
            ? all.filter((s) => myIDs.has(s.subjectID))
            : all;
          if (initialList.length > 0) {
            setSelectedSubjectID(initialList[0].subjectID);
            setTempSelectedSubjectID(initialList[0].subjectID);
          }
        }
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText="Gagal memuatkan senarai subjek" messagecolor="red" />);
      });
  }, []);

  const GetData = useCallback((silent = false) => {
    if (!selectedSubjectID) {
      setMyData([]);
      return;
    }
    setLoading(true);
    if (!silent) setMessage(null);
    axiosInstance
      .get(`/headcount/?subjectID=${selectedSubjectID}`)
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        if (data.length === 0 && !silent) {
          setMessage(<MyMessage key={Date.now()} messageText="Tiada rekod pelajar untuk subjek ini" messagecolor="orange" />);
        }
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText={err.response?.data?.message || "Gagal memuatkan data headcount"} messagecolor="red" />);
        setMyData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSubjectID]);

  useEffect(() => {
    autoCalcDoneRef.current = false;
  }, [selectedSubjectID]);

  useEffect(() => {
    GetData();
  }, [GetData]);

  useEffect(() => {
    if (!canCalculateOTI || myData.length === 0 || autoCalcDoneRef.current) return;

    const needsOTI = myData.some(
      (row) =>
        (row.TOVmark != null && row.ETRmark != null && row.OTI1mark == null) ||
        (row.AR1mark != null && row.ETRmark != null && row.OTI2mark == null)
    );

    if (!needsOTI) return;

    autoCalcDoneRef.current = true;
    axiosInstance
      .post("/headcount/calculate-oti/", { subjectID: selectedSubjectID, method: "formula" })
      .then(() => GetData(true))
      .catch(() => {});
  }, [myData, canCalculateOTI, selectedSubjectID, GetData]);

  const selectedSubjectName = useMemo(() => {
    const subject = subjectsList.find((s) => s.subjectID === selectedSubjectID);
    return subject ? subject.subjectName : "Pilih Mata Pelajaran";
  }, [selectedSubjectID, subjectsList]);

  const selectedSubjectCode = useMemo(() => {
    const subject = subjectsList.find((s) => s.subjectID === selectedSubjectID);
    return subject?.subjectCode || "";
  }, [selectedSubjectID, subjectsList]);

  const handleOpenDialog = () => {
    setTempSelectedSubjectID(selectedSubjectID);
    setDialogOpen(true);
  };

  const handleSubjectConfirm = () => {
    setSelectedSubjectID(tempSelectedSubjectID);
    setDialogOpen(false);
  };

  const handleCalculateOTI = async () => {
    if (!selectedSubjectID) return;
    setOtiLoading(true);
    try {
      const res = await axiosInstance.post("/headcount/calculate-oti/", {
        subjectID: selectedSubjectID,
        method: otiMethod,
      });
      setOtiDialogOpen(false);
      autoCalcDoneRef.current = true;
      setMessage(
        <MyMessage key={Date.now()} messageText={res.data.message} messagecolor="green" />
      );
      GetData(true);
    } catch (err) {
      setMessage(
        <MyMessage
          key={Date.now()}
          messageText={err.response?.data?.message || "Gagal mengira OTI"}
          messagecolor="red"
        />
      );
    } finally {
      setOtiLoading(false);
    }
  };

  const markGradeCell = (markKey, gradeKey, compareKey = null) => ({
    enableEditing: false,
    size: 100,
    muiTableHeadCellProps: { align: "center" },
    muiTableBodyCellProps: ({ row }) => {
      let backgroundColor;
      if (compareKey !== null) {
        const grade       = row.original[gradeKey];
        const mark        = row.original[markKey];
        const compareMark = row.original[compareKey];
        if (grade === "TH") {
          backgroundColor = "#ffcdd2";
        } else if (mark != null && compareMark != null) {
          backgroundColor = compareMark >= mark ? "#ffcdd2" : "#c8e6c9";
        }
      }
      return { align: "center", style: { backgroundColor, padding: 0 } };
    },
    Cell: ({ row }) => {
      const mark  = row.original[markKey];
      const grade = row.original[gradeKey];
      if (mark == null && !grade)
        return (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", px: 1.5, py: 1, height: "100%" }}>
            <Typography variant="body2" color="text.secondary">—</Typography>
          </Box>
        );
      return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, px: 1.5, py: 1, height: "100%" }}>
          <Typography variant="body2">{mark != null ? Math.round(mark) : ""}</Typography>
          {grade && (
            <Chip
              label={grade}
              size="small"
              color={gradeColor(grade)}
              sx={{ fontSize: 11, height: 20, minWidth: 32, fontWeight: 600 }}
            />
          )}
        </Box>
      );
    },
  });

  const columns = useMemo(() => [
    { header: "Bil", accessorFn: (_, index) => index + 1, id: "bil", enableEditing: false, enableSorting: false, size: 60 },
    { accessorKey: "studentName", header: "Nama",  enableEditing: false, size: 200 },
    {
      accessorKey: "className", header: "Kelas", enableEditing: false, size: 60,
      Cell: ({ cell }) => <Typography variant="body2">{cell.getValue() || "—"}</Typography>,
    },
    { id: "tov",  header: "TOV",  ...markGradeCell("TOVmark",  "TOVgrade")  },
    { id: "ar1",  header: "AR1",  ...markGradeCell("AR1mark",  "AR1grade",  "OTI1mark") },
    { id: "oti1", header: "OTI1", ...markGradeCell("OTI1mark", "OTI1grade") },
    { id: "ar2",  header: "AR2",  ...markGradeCell("AR2mark",  "AR2grade",  "OTI2mark") },
    { id: "oti2", header: "OTI2", ...markGradeCell("OTI2mark", "OTI2grade") },
    { id: "etr",  header: "ETR",  ...markGradeCell("ETRmark",  "ETRgrade")  },
  ], []);

  return (
    <Box>
      <PageHeader
        icon={<PieChartIcon sx={{ color: "primary.main" }} />}
        title={`Headcount Pelajar - ${selectedSubjectName}`}
      >
        {canCalculateOTI && (
          <PrimaryButton
            startIcon={<CalculateIcon />}
            onClick={() => { setOtiMethod("formula"); setOtiDialogOpen(true); }}
          >
            Kira - OTI
          </PrimaryButton>
        )}
        <PrimaryButton startIcon={<CategoryIcon />} onClick={handleOpenDialog}>
          Mata Pelajaran{selectedSubjectCode && ` - ${selectedSubjectCode}`}
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        columns={columns}
        data={myData}
        loading={loading}
        enableRowActions={false}
      />

      {/* ── Select Subject Dialog ─────────────────────────────────────────── */}
      <DialogBox
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Pilih Mata Pelajaran"
        onConfirm={handleSubjectConfirm}
        maxWidth="xs"
      >
        {selectedSubjectID && (
          <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Mata Pelajaran semasa: <strong>{selectedSubjectName}</strong>
            </Typography>
          </Box>
        )}
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="subject-select-label">Pilih Mata Pelajaran</InputLabel>
          <Select
            labelId="subject-select-label"
            value={tempSelectedSubjectID}
            label="Pilih Mata Pelajaran"
            onChange={(e) => setTempSelectedSubjectID(e.target.value)}
          >
            {dropdownSubjects.map((subject) => (
              <MenuItem key={subject.subjectID} value={subject.subjectID}>
                {subject.subjectName}{subject.subjectCode && ` (${subject.subjectCode})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogBox>

      {/* ── Calculate OTI Dialog ──────────────────────────────────────────── */}
      <DialogBox
        open={otiDialogOpen}
        onClose={() => setOtiDialogOpen(false)}
        title="Pilihan Pengiraan OTI"
        onConfirm={handleCalculateOTI}
        loading={otiLoading}
        maxWidth="xs"
      >
        <Box sx={{ mb: 2, p: 1.5, bgcolor: "#f5f7fa", borderRadius: 1, border: "1px solid #e0e0e0" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Mata Pelajaran:
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {selectedSubjectName}{selectedSubjectCode && ` (${selectedSubjectCode})`}
          </Typography>
        </Box>

        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="oti-method-label">Kaedah Pengiraan</InputLabel>
          <Select
            labelId="oti-method-label"
            value={otiMethod}
            label="Kaedah Pengiraan"
            onChange={(e) => setOtiMethod(e.target.value)}
          >
            {OTI_METHODS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}{opt.disabled && " (Akan Datang)"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {otiMethod === "formula" && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Formula yang digunakan:
            </Typography>
            <Typography variant="caption" display="block">
              OTI1 = TOV + (ETR − TOV) × ⅓
            </Typography>
            <Typography variant="caption" display="block">
              OTI2 = AR1 + (ETR − AR1) × ½
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              * Hanya rekod dengan markah TOV/AR1 dan ETR akan dikira.
            </Typography>
          </Box>
        )}
        {otiMethod === "ai" && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "#e8f5e9", borderRadius: 1, border: "1px solid #a5d6a7" }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Kaedah AI (Random Forest):
            </Typography>
            <Typography variant="caption" display="block">
              • Model dilatih menggunakan data Headcount tahun-tahun lepas untuk mata pelajaran yang sama.
            </Typography>
            <Typography variant="caption" display="block">
              • OTI1 diramal berdasarkan TOV dan ETR.
            </Typography>
            <Typography variant="caption" display="block">
              • OTI2 diramal berdasarkan AR1 dan ETR.
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              * Memerlukan sekurang-kurangnya 5 rekod data lepas untuk melatih model.
            </Typography>
          </Box>
        )}
      </DialogBox>
    </Box>
  );
};

export default HeadcountList;