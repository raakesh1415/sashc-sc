import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
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
  MenuBook as SubjectIcon,
  Category as CategoryIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton } from "../layout/Buttons";
import DialogBox from "../layout/DialogBox";
import AppTable from "../layout/AppTable";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";
import { AuthContext } from "../../AuthProvider";

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

const gradeColor = (grade) => {
  if (!grade) return "default";
  if (grade === "TH") return "default";
  if (["A+", "A", "A-"].includes(grade)) return "success";
  if (["B+", "B", "C+", "C"].includes(grade)) return "info";
  if (["D+", "D", "E"].includes(grade)) return "warning";
  return "error"; // G
};

const SubjectRanking = () => {
  const { userRoles } = useContext(AuthContext); 
  const isSubjectTeacherOnly = userRoles.includes("Subject Teacher") && !userRoles.includes("Admin");

  const [myData, setMyData] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teacherSubjectIDs, setTeacherSubjectIDs] = useState(new Set());
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState("TOV");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [tempSelectedExam, setTempSelectedExam] = useState("TOV");
  const [tempSelectedSubject, setTempSelectedSubject] = useState("");
  const [sorting, setSorting] = useState([{ id: 'ranking', desc: false }]);

  const examOptions = [
    { value: "TOV", label: "TOV" },
    { value: "AR1", label: "AR1" },
    { value: "AR2", label: "AR2" },
    { value: "ETR", label: "ETR" },
  ];

  const dropdownSubjects = isSubjectTeacherOnly
    ? subjects.filter((s) => teacherSubjectIDs.has(s.subjectID))
    : subjects;

  const GetSubjects = useCallback(() => {
    const allSubjectsReq = axiosInstance.get("/subjects/");
    const mySubjectsReq = isSubjectTeacherOnly
      ? axiosInstance.get("/headcount/my-subjects/")
      : Promise.resolve({ data: { data: [] } });

    Promise.all([allSubjectsReq, mySubjectsReq])
      .then(([allRes, myRes]) => {
        const all = allRes.data.data || [];
        const mySubjs = myRes.data.data || [];
        const myIDs = new Set(mySubjs.map((s) => s.subjectID));

        setSubjects(all);
        setTeacherSubjectIDs(myIDs);

        const initialList = isSubjectTeacherOnly
          ? all.filter((s) => myIDs.has(s.subjectID))
          : all;
        if (initialList.length > 0 && !selectedSubject) {
          setSelectedSubject(initialList[0].subjectID);
          setTempSelectedSubject(initialList[0].subjectID);
        }
      })
      .catch(() => {});
  }, [selectedSubject, isSubjectTeacherOnly]);

  useEffect(() => {
    GetSubjects();
  }, [GetSubjects]);

  const GetData = useCallback(() => {
    if (!selectedExam || !selectedSubject) {
      setMyData([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    axiosInstance
      .get(`/ranking-subject/?exam=${selectedExam}&subjectID=${selectedSubject}`)
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);
        if (data.length === 0) {
          setMessage(
            <MyMessage
              messageText="Tiada data kedudukan untuk mata pelajaran ini"
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
  }, [selectedExam, selectedSubject]);

  useEffect(() => {
    GetData();
  }, [GetData]);

  const handleOpenDialog = () => {
    setTempSelectedExam(selectedExam);
    setTempSelectedSubject(selectedSubject);
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    setSelectedExam(tempSelectedExam);
    setSelectedSubject(tempSelectedSubject);
    setDialogOpen(false);
  };

  const selectedSubjectName = useMemo(() => {
    const subject = subjects.find(s => s.subjectID === selectedSubject);
    return subject ? subject.subjectName : "";
  }, [subjects, selectedSubject]);

  const selectedSubjectCode = useMemo(() => {
    const subject = subjects.find(s => s.subjectID === selectedSubject);
    return subject ? subject.subjectCode : "";
  }, [subjects, selectedSubject]);

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
          <Typography variant="body2">{cell.getValue()}</Typography>
        ),
      },
      {
        accessorKey: "className",
        header: "Kelas",
        enableEditing: false,
        enableSorting: true,
        size: 80,
        Cell: ({ cell }) => (
          <Typography variant="body2">{cell.getValue() || "—"}</Typography>
        ),
      },
      {
        accessorKey: "mark",
        header: "Markah",
        enableEditing: false,
        enableSorting: true,
        size: 80,
        sortingFn: "alphanumeric",
        Cell: ({ cell, row }) => {
          const mark = cell.getValue();
          const grade = row.original.grade;
          if (grade === "TH" || mark === null || mark === undefined) {
            return (
              <Typography variant="body2" color="text.secondary">—</Typography>
            );
          }
          return (
            <Typography variant="body2" fontWeight={600}>
              {Math.round(mark)}
            </Typography>
          );
        },
      },
      {
        accessorKey: "grade",
        header: "Gred",
        enableEditing: false,
        enableSorting: true,
        size: 80,
        Cell: ({ cell }) => {
          const grade = cell.getValue();
          if (!grade) return <Typography variant="body2">—</Typography>;
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
                    fontSize: 20,
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
        icon={<SubjectIcon sx={{ color: "primary.main" }} />}
        title={`Kedudukan Mata Pelajaran - ${selectedSubjectName || "Pilih Mata Pelajaran"}`}
      >
        <PrimaryButton startIcon={<CategoryIcon />} onClick={handleOpenDialog}>
          Mata Pelajaran - {selectedSubjectCode || "Select"}
        </PrimaryButton>
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
          const isSortedByRanking = sorting.length > 0 && (sorting[0].id === "ranking" || sorting[0].id === "mark");
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

      {/* ── Select Subject & Exam Dialog ─────────────────────────────────── */}
      <DialogBox
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Pilih Mata Pelajaran & Peperiksaan"
        onConfirm={handleConfirm}
        maxWidth="xs"
      >
        <Box sx={{ mb: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Pilihan semasa: <strong>{selectedSubjectCode}</strong> -{" "}
            <strong>{selectedExam}</strong>
          </Typography>
        </Box>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="subject-select-label">Pilih Mata Pelajaran</InputLabel>
          <Select
            labelId="subject-select-label"
            value={tempSelectedSubject}
            label="Pilih Mata Pelajaran"
            onChange={(e) => setTempSelectedSubject(e.target.value)}
          >
            {dropdownSubjects.map((subject) => (
              <MenuItem key={subject.subjectID} value={subject.subjectID}>
                {subject.subjectName}
                {subject.subjectCode && ` (${subject.subjectCode})`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel id="exam-select-label">Pilih Peperiksaan</InputLabel>
          <Select
            labelId="exam-select-label"
            value={tempSelectedExam}
            label="Pilih Peperiksaan"
            onChange={(e) => setTempSelectedExam(e.target.value)}
          >
            {examOptions.map((exam) => (
              <MenuItem key={exam.value} value={exam.value}>
                {exam.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogBox>
    </Box>
  );
};

export default SubjectRanking;