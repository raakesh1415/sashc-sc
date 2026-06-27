import React, { useState, useEffect } from "react";
import axiosInstance from "../../AxiosInstance";
import {
  Box,
  Typography,
  CircularProgress,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  Chip,
  Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, BackButton } from "../layout/Buttons";
import { Formik } from "formik";
import * as yup from "yup";
import MyMessage from "../layout/Message";
import TextForm from "../layout/TextForm";
import SelectField from "../layout/SelectField";
import CheckboxGroup from "../layout/CheckboxGroup";
import { useNavigate, useParams } from "react-router-dom";
import { useYear } from "../../YearContext";

// ─── API error parser ─────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES = ["Admin", "Subject Teacher", "Class Teacher", "Student"];
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

const GENDER_OPTIONS = [
  { value: "",       label: "-- Pilih Jantina --" },
  { value: "Male",   label: "Lelaki" },
  { value: "Female", label: "Perempuan" },
];

const STATUS_OPTIONS = [
  { value: true,  label: "Aktif" },
  { value: false, label: "Tidak Aktif" },
];

const IS_PRINCIPAL_OPTIONS = [
  { value: false, label: "Tidak" },
  { value: true,  label: "Ya"    },
];

const TEACHER_ROLES = ["Admin", "Subject Teacher", "Class Teacher"];

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = yup.object().shape({
  name:         yup.string().required("Nama diperlukan").min(2, "Nama terlalu pendek"),
  email:        yup.string().email("Format emel tidak sah").required("Emel diperlukan"),
  classID:      yup.string().nullable().when('role', {
    is: (role) => Array.isArray(role) && role.includes('Student'),
    then: (schema) => schema.required("Sila pilih kelas"),
    otherwise: (schema) => schema.nullable(),
  }),
  gender:       yup.string().required("Sila pilih jantina"),
  role:         yup.array().min(1, "Sila pilih sekurang-kurangnya satu peranan"),
  is_active:    yup.boolean().required("Status diperlukan"),
  is_principal: yup.boolean(),
});

// ─── Component ────────────────────────────────────────────────────────────────

const EditUser = () => {
  const theme = useTheme();
  const { id } = useParams();
  const navigate = useNavigate();
  const year = useYear();

  const [message, setMessage]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [subjectsList, setSubjectsList]   = useState([]);
  const [classesList, setClassesList]     = useState([]);
  const [initialValues, setInitialValues] = useState(null);
  
  // Subject-Class enrollment state for Subject Teachers
  const [subjectClassMap, setSubjectClassMap] = useState({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, subRes, classRes] = await Promise.all([
          axiosInstance.get(`/users/${id}/`),
          axiosInstance.get("/subjects/"),
          axiosInstance.get("/classes/"),
        ]);

        const userData = userRes.data.data || userRes.data;
        setSubjectsList(subRes.data.data || []);
        setClassesList(classRes.data.data || []);

        let currentClassID = "";
        let currentSubjectClassMap = {};

        if (userData.studentID) {
          currentClassID = userData.studentID.classID?.classID || "";
          
          const enrollments = userData.studentID.enrollSubjectID?.enrollments || [];
          enrollments.forEach((enroll) => {
            currentSubjectClassMap[enroll.subjectID.subjectID] = [];
          });
        }

        if (userData.teacherID) {
          if (!currentClassID) currentClassID = userData.teacherID.classID?.classID || "";
          
          const enrollments = userData.teacherID.enrollSubjectID?.enrollments || [];
          enrollments.forEach((enroll) => {
            const subjID = enroll.subjectID.subjectID;
            const clsID  = enroll.classID?.classID;
            
            if (!currentSubjectClassMap[subjID]) {
              currentSubjectClassMap[subjID] = [];
            }
            if (clsID) {
              currentSubjectClassMap[subjID].push(clsID);
            }
          });
        }

        setSubjectClassMap(currentSubjectClassMap);

        setInitialValues({
          name:         userData.name      || "",
          email:        userData.email     || "",
          year:         userData.year      ?? "",
          classID:      currentClassID,
          gender:       userData.gender    || "",
          role:         userData.role      || ["Student"],
          is_active:    userData.is_active ?? true,
          is_principal: userData.teacherID?.is_principal ?? false,
        });
      } catch (err) {
        setMessage(<MyMessage key={Date.now()} messageText="Gagal memuatkan data pengguna." messagecolor="red" />);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const handleFormSubmit = (values, { setSubmitting }) => {
    const isSubjectTeacher = values.role.includes("Subject Teacher");
    const isTeacherRole = values.role.some((r) => TEACHER_ROLES.includes(r));

    let payload = {
      ...values,
      year:         values.year ? Number(values.year) : null,
      classID:      values.classID || null,
      is_active:    values.is_active,
      is_principal: isTeacherRole ? values.is_principal : false,
    };

    if (isSubjectTeacher) {
      const subjectClassEnrollments = Object.entries(subjectClassMap)
        .filter(([subjectID, classIDs]) => classIDs && classIDs.length > 0)
        .map(([subjectID, classIDs]) => ({
          subjectID,
          classIDs,
        }));
      
      payload.subjectClassEnrollments = subjectClassEnrollments;
      delete payload.subjectID;
    } else {
      const selectedSubjects = Object.keys(subjectClassMap);
      payload.subjectID = selectedSubjects;
      delete payload.subjectClassEnrollments;
    }

    axiosInstance.put(`/users/${id}/`, payload)
      .then(() => {
        setMessage(<MyMessage key={Date.now()} messageText="Rekod pengguna berjaya dikemaskini!" messagecolor="green" />);
        setTimeout(() => navigate(`/${year}/users`), 1500);
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText={parseApiError(err, 'Gagal mengemaskini rekod.')} messagecolor="red" />);
        setSubmitting(false);
      });
  };

  const handleSubjectToggle = (subjectID, checked) => {
    setSubjectClassMap((prev) => {
      const newMap = { ...prev };
      if (checked) {
        newMap[subjectID] = [];
      } else {
        delete newMap[subjectID];
      }
      return newMap;
    });
  };

  const handleClassToggle = (subjectID, classID, checked) => {
    setSubjectClassMap((prev) => {
      const newMap = { ...prev };
      const classes = newMap[subjectID] || [];
      if (checked) {
        newMap[subjectID] = [...classes, classID];
      } else {
        newMap[subjectID] = classes.filter((c) => c !== classID);
      }
      return newMap;
    });
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box>
      <PageHeader icon={<EditIcon sx={{ color: "primary.main" }} />} title="Kemaskini Rekod Pengguna">
        <BackButton onClick={() => navigate(`/${year}/users`)} sx={{ px: 4 }} />
      </PageHeader>

      {message}

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleFormSubmit}
        enableReinitialize
      >
        {({
          values,
          errors,
          touched,
          handleBlur,
          handleChange,
          handleSubmit,
          setFieldValue,
          isSubmitting,
        }) => {
          const isStudent = values.role.includes("Student");
          const isSubjectTeacher = values.role.includes("Subject Teacher");
          const isTeacher = values.role.some((r) => TEACHER_ROLES.includes(r));

          const isDisabled = (role) => {
            if (isStudent && TEACHER_ROLES.includes(role)) return true;
            if (isTeacher && role === "Student") return true;
            return false;
          };

          const handleRoleChange = (role, checked) => {
            if (isDisabled(role)) return;
            if (checked) {
              if (role === "Student") {
                setSubjectClassMap({});
                setFieldValue("role", ["Student"]);
              } else {
                const newRoles = values.role.filter((r) => r !== "Student");
                if (!newRoles.includes(role)) newRoles.push(role);
                if (role === "Subject Teacher") setSubjectClassMap({});
                setFieldValue("role", newRoles);
              }
            } else {
              if (role === "Student") setFieldValue("classID", "");
              if (role === "Subject Teacher") setSubjectClassMap({});
              setFieldValue("role", values.role.filter((r) => r !== role));
            }
          };

          return (
            <form onSubmit={handleSubmit}>
              {/* Main Form Card */}
              <Box
                sx={{
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  boxShadow: 1,
                  p: 3,
                }}
              >
                {/* Maklumat Peribadi Section */}
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                  Maklumat Peribadi
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
                  {/* Peranan */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Peranan <span style={{ color: theme.palette.error.main }}>*</span>
                    </Typography>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: "#f5f5f5",
                        borderRadius: 1,
                        border: `1px solid ${errors.role && touched.role ? theme.palette.error.main : "#e0e0e0"}`,
                      }}
                    >
                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                        {ALL_ROLES.map((role) => {
                          const selected = values.role.includes(role);
                          const disabled = isDisabled(role);
                          return (
                            <Chip
                              key={role}
                              label={ROLE_LABELS[role]}
                              color={selected ? ROLE_COLORS[role] : "default"}
                              onClick={() => handleRoleChange(role, !selected)}
                              sx={{
                                fontWeight: selected ? 600 : 400,
                                cursor: disabled ? "not-allowed" : "pointer",
                                opacity: disabled ? 0.38 : 1,
                                pointerEvents: disabled ? "none" : "auto",
                              }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                    {errors.role && touched.role && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block", ml: 1.5 }}>
                        {errors.role}
                      </Typography>
                    )}
                  </Box>

                  {/* Row 1 */}
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <TextForm
                        label="Nama Penuh"
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={!!touched.name && !!errors.name}
                        helperText={touched.name && errors.name}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <TextForm
                        label="Emel"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={!!touched.email && !!errors.email}
                        helperText={touched.email && errors.email}
                      />
                    </Box>
                  </Box>

                  {/* Row 2 */}
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <SelectField
                        label="Jantina"
                        name="gender"
                        value={values.gender}
                        options={GENDER_OPTIONS}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={!!touched.gender && !!errors.gender}
                        helperText={touched.gender && errors.gender}
                      />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <SelectField
                        label="Status"
                        name="is_active"
                        value={values.is_active}
                        options={STATUS_OPTIONS}
                        onChange={(e) => {
                          const value = e.target.value === 'true' || e.target.value === true;
                          setFieldValue('is_active', value);
                        }}
                        onBlur={handleBlur}
                        error={!!touched.is_active && !!errors.is_active}
                        helperText={touched.is_active && errors.is_active}
                      />
                    </Box>
                  </Box>

                  {/* Pengetua - only for teacher roles */}
                  {isTeacher && (
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <SelectField
                          label="Pengetua"
                          name="is_principal"
                          value={values.is_principal}
                          options={IS_PRINCIPAL_OPTIONS}
                          onChange={(e) => {
                            const val = e.target.value === true || e.target.value === "true";
                            setFieldValue("is_principal", val);
                          }}
                          onBlur={handleBlur}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }} />
                    </Box>
                  )}

                  {/* Row 3 - Student specific */}
                  {isStudent && (
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <SelectField
                          label="Kelas"
                          name="classID"
                          value={values.classID}
                          options={[
                            { value: "", label: "-- Pilih Kelas --" },
                            ...classesList.map((c) => ({
                              value: c.classID,
                              label: c.className,
                            })),
                          ]}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={!!touched.classID && !!errors.classID}
                          helperText={touched.classID && errors.classID}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }} />
                    </Box>
                  )}
                </Box>

                {/* Divider */}
                {(isStudent || isSubjectTeacher) && (
                  <Box
                    sx={{
                      borderTop: "2px solid #e0e0e0",
                      mb: 3
                    }}
                  />
                )}

                {/* Mata Pelajaran Section - for Students and Subject Teachers */}
                {(isStudent || isSubjectTeacher) && (
                  <>
                    {isStudent && (
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
                        Mata Pelajaran Diambil
                      </Typography>
                    )}

                    {isSubjectTeacher && (
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                        Mata Pelajaran & Kelas
                      </Typography>
                    )}

                    {/* Subject-Class Table for Subject Teachers */}
                    {isSubjectTeacher && (
                      <>
                        <TableContainer component={Paper} sx={{ maxHeight: 500, mb: 1 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, bgcolor: "background.paper" }}>
                                  Mata Pelajaran
                                </TableCell>
                                {classesList.map((cls) => (
                                  <TableCell
                                    key={cls.classID}
                                    align="center"
                                    sx={{ fontWeight: 600, bgcolor: "background.paper" }}
                                  >
                                    {cls.className}
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {subjectsList.map((subj) => {
                                const isSubjectSelected = subjectClassMap.hasOwnProperty(subj.subjectID);
                                const selectedClasses = subjectClassMap[subj.subjectID] || [];

                                return (
                                  <TableRow key={subj.subjectID} hover>
                                    <TableCell>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            checked={isSubjectSelected}
                                            onChange={(e) =>
                                              handleSubjectToggle(subj.subjectID, e.target.checked)
                                            }
                                          />
                                        }
                                        label={<Typography variant="body2">{subj.subjectName}</Typography>}
                                      />
                                    </TableCell>
                                    {classesList.map((cls) => (
                                      <TableCell key={cls.classID} align="center">
                                        <Checkbox
                                          disabled={!isSubjectSelected}
                                          checked={selectedClasses.includes(cls.classID)}
                                          onChange={(e) =>
                                            handleClassToggle(
                                              subj.subjectID,
                                              cls.classID,
                                              e.target.checked
                                            )
                                          }
                                        />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 4 }}>
                          Pilih mata pelajaran terlebih dahulu, kemudian pilih kelas yang berkaitan
                        </Typography>
                      </>
                    )}

                    {/* Simple Subject Checkboxes for Students */}
                    {isStudent && !isSubjectTeacher && (
                      <Box sx={{ mb: 4 }}>
                        <CheckboxGroup
                          label=""
                          options={subjectsList.map((s) => ({
                            value: s.subjectID,
                            label: s.subjectName,
                          }))}
                          selectedValues={Object.keys(subjectClassMap)}
                          onChange={(subjectID, checked) => handleSubjectToggle(subjectID, checked)}
                          columns={4}
                        />
                      </Box>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
                  <PrimaryButton
                    type="submit"
                    startIcon={!isSubmitting ? <SaveIcon /> : null}
                    disabled={isSubmitting}
                    sx={{ px: 4 }}
                  >
                    {isSubmitting ? (
                      <>
                        <CircularProgress size={18} sx={{ mr: 1, color: "white" }} />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan"
                    )}
                  </PrimaryButton>
                </Box>
              </Box>
            </form>
          );
        }}
      </Formik>
    </Box>
  );
};

export default EditUser;