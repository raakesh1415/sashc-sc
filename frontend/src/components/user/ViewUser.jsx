import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useYear } from "../../YearContext";
import axiosInstance from "../../AxiosInstance";
import {
  Box,
  Typography,
  CircularProgress,
  useTheme,
  Chip,
  Stack,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import PageHeader from "../layout/PageHeader";
import { BackButton, PrimaryButton } from "../layout/Buttons";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  Admin: "Pentadbir",
  "Subject Teacher": "Guru Mata Pelajaran",
  "Class Teacher": "Guru Kelas",
  Student: "Pelajar",
};

const ROLE_COLORS = {
  Admin: "error",
  "Subject Teacher": "warning",
  "Class Teacher": "info",
  Student: "success",
};

// ─── Component ────────────────────────────────────────────────────────────────

const ViewUser = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const year = useYear();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [subjectsList, setSubjectsList] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, subRes, classRes] = await Promise.all([
          axiosInstance.get(`/users/${id}/`),
          axiosInstance.get("/subjects/"),
          axiosInstance.get("/classes/"),
        ]);

        const data = userRes.data.data || userRes.data;
        setSubjectsList(subRes.data.data || []);
        setClassesList(classRes.data.data || []);

        let currentClassID = "";
        let subjects = [];

        if (data.studentID) {
          currentClassID = data.studentID.classID?.classID || "";
          const enrollments = data.studentID.enrollSubjectID?.enrollments || [];
          subjects = enrollments.map((enroll) => ({
            subjectID: enroll.subjectID.subjectID,
            subjectName: enroll.subjectName,
          }));
        }

        if (data.teacherID) {
          if (!currentClassID)
            currentClassID = data.teacherID.classID?.classID || "";
          const enrollments = data.teacherID.enrollSubjectID?.enrollments || [];

          // For teachers, group by subject and collect classes
          const subjectClassMap = {};
          enrollments.forEach((enroll) => {
            const subjID = enroll.subjectID.subjectID;
            const subjName = enroll.subjectName;
            const classID = enroll.classID?.classID;
            const className = enroll.classID?.className;

            if (!subjectClassMap[subjID]) {
              subjectClassMap[subjID] = {
                subjectID: subjID,
                subjectName: subjName,
                classes: [],
              };
            }

            if (classID && className) {
              if (
                !subjectClassMap[subjID].classes.find(
                  (c) => c.classID === classID
                )
              ) {
                subjectClassMap[subjID].classes.push({
                  classID: classID,
                  className: className,
                });
              }
            }
          });

          subjects = Object.values(subjectClassMap);
        }

        setEnrolledSubjects(subjects);

        setUserData({
          name: data.name || "",
          email: data.email || "",
          year: data.year ?? "",
          classID: currentClassID,
          gender: data.gender || "",
          role: data.role || [],
          status: data.is_active ? "Aktif" : "Tidak Aktif",
          is_principal: data.teacherID?.is_principal ?? false,
        });
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );

  if (!userData)
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Gagal memuatkan data pengguna.</Typography>
      </Box>
    );

  const isStudent = userData.role.includes("Student");
  const isSubjectTeacher = userData.role.includes("Subject Teacher");
  const isTeacher = ["Admin", "Subject Teacher", "Class Teacher"].some((r) => userData.role.includes(r));
  const className =
    classesList.find((c) => c.classID === userData.classID)?.className || "—";

  return (
    <Box>
      <PageHeader icon={<VisibilityIcon sx={{ color: "primary.main" }} />} title="Rekod Pengguna">
        <BackButton onClick={() => navigate(`/${year}/users`)} />
        <PrimaryButton startIcon={<EditIcon />} onClick={() => navigate(`/${year}/users/edit/${id}`)}>
          Edit
        </PrimaryButton>
      </PageHeader>

      {/* Profile Information Card */}
      <Box
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 1,
          p: 3,
          mb: 3,
        }}
      >
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
          Maklumat Peribadi
        </Typography>

        <Box sx={{ display: "flex", gap: 4 }}>
          {/* Column 1 */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Nama:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#f5f5f5",
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                }}
              >
                <Typography variant="body1">{userData.name}</Typography>
              </Box>
            </Box>


            <Box sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Jantina:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#f5f5f5",
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                }}
              >
                <Typography variant="body1">
                  {userData.gender === "Male"
                    ? "Lelaki"
                    : userData.gender === "Female"
                    ? "Perempuan"
                    : "—"}
                </Typography>
              </Box>
            </Box>

            {isStudent && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Kelas:
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "#f5f5f5",
                    borderRadius: 1,
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <Typography variant="body1">{className}</Typography>
                </Box>
              </Box>
            )}

            {isTeacher && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Pengetua:
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "#f5f5f5",
                    borderRadius: 1,
                    border: "1px solid #e0e0e0",
                  }}
                >
                  {userData.is_principal ? (
                    <Chip label="Ya" color="success" size="small" sx={{ fontWeight: 600 }} />
                  ) : (
                    <Chip label="Tidak" color="default" size="small" sx={{ fontWeight: 600 }} />
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* Column 2 */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Emel:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#f5f5f5",
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                }}
              >
                <Typography variant="body1">{userData.email}</Typography>
              </Box>
            </Box>

            <Box sx={{ mb: isTeacher ? 3 : 0 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Peranan:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#f5f5f5",
                  borderRadius: 1,
                  border: "1px solid #e0e0e0",
                }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  {userData.role.map((role) => (
                    <Chip
                      key={role}
                      label={ROLE_LABELS[role] || role}
                      color={ROLE_COLORS[role] || "default"}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Subjects Card */}
      {(isStudent || isSubjectTeacher) && <Box
        sx={{
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 1,
          p: 3,
        }}
      >
        {isStudent && (
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            Mata Pelajaran Diambil
          </Typography>
        )}

        {!isStudent && (
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
            Mata Pelajaran Diajar
          </Typography>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          {enrolledSubjects.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1.5,
                width: "100%",
              }}
            >
              {enrolledSubjects.map((subject) => (
                <Box
                  key={subject.subjectID}
                  sx={{
                    p: 2,
                    bgcolor: "#f5f5f5",
                    borderRadius: 1,
                    border: "1px solid #e0e0e0",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <Typography
                    variant="body1"
                    fontWeight={600}
                    color="primary"
                  >
                    {subject.subjectName}
                  </Typography>

                  {/* For teachers, show classes */}
                  {!isStudent &&
                    subject.classes &&
                    subject.classes.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          flexWrap="wrap"
                          gap={0.5}
                          justifyContent="center"
                        >
                          {subject.classes.map((cls) => (
                            <Chip
                              key={cls.classID}
                              label={cls.className}
                              size="small"
                              sx={{
                                height: '25px',
                                fontSize: '0.8rem',
                                bgcolor: theme.palette.secondary.main,
                                color: theme.palette.secondary.text,
                                fontWeight: 600,
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {isStudent
                ? "Tiada mata pelajaran diambil"
                : "Tiada mata pelajaran diajar"}
            </Typography>
          )}
        </Box>
      </Box>}
    </Box>
  );
};

export default ViewUser;