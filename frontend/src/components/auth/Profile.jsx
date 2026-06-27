import React, { useState, useEffect } from "react";
import axiosInstance from "../../AxiosInstance";
import { ROLE_ORDER } from "../../constants";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Avatar,
  useTheme,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, BackButton } from "../layout/Buttons";
import DialogBox from "../layout/DialogBox";
import { Formik } from "formik";
import * as yup from "yup";
import MyMessage from "../layout/Message";
import TextForm from "../layout/TextForm";
import SelectField from "../layout/SelectField";

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
  { value: "", label: "-- Pilih Jantina --" },
  { value: "Male", label: "Lelaki" },
  { value: "Female", label: "Perempuan" },
];

// ─── Validation ───────────────────────────────────────────────────────────────

const validationSchema = yup.object().shape({
  name: yup
    .string()
    .required("Nama diperlukan")
    .min(2, "Nama terlalu pendek"),
  classID: yup.string().nullable(),
  gender: yup.string().required("Sila pilih jantina"),
});

// ─── Component ────────────────────────────────────────────────────────────────

const Profile = () => {
  const theme = useTheme();
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [managedClassName, setManagedClassName] = useState(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [passwordMsgKey, setPasswordMsgKey] = useState(0);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const userEmail = localStorage.getItem("userEmail");
      const usersRes = await axiosInstance.get("/users/");
      const currentUser = usersRes.data.data.find((u) => u.email === userEmail);

      if (!currentUser) throw new Error("User not found");

      const [userRes, classRes, subRes] = await Promise.all([
        axiosInstance.get(`/users/${currentUser.userID}/`),
        axiosInstance.get("/classes/"),
        axiosInstance.get("/subjects/"),
      ]);

      const data = userRes.data.data || userRes.data;
      const allClasses = classRes.data.data || [];
      setClassesList(allClasses);
      setSubjectsList(subRes.data.data || []);

      let currentClassID = "";
      let subjects = [];
      let managedClass = null;

      if (data.studentID) {
        currentClassID = data.studentID.classID?.classID || "";
        const enrollments = data.studentID.enrollSubjectID?.enrollments || [];
        subjects = enrollments.map((enroll) => ({
          subjectID: enroll.subjectID.subjectID,
          subjectName: enroll.subjectName,
        }));
      }

      if (data.teacherID) {
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
              classes: []
            };
          }

          if (classID && className) {
            // Avoid duplicate classes
            if (!subjectClassMap[subjID].classes.find(c => c.classID === classID)) {
              subjectClassMap[subjID].classes.push({
                classID: classID,
                className: className
              });
            }
          }
        });
        
        subjects = Object.values(subjectClassMap);

        // Check if this teacher is a Class Teacher and find their managed class
        if (data.role && data.role.includes('Class Teacher')) {
          // Find the class where this teacher's userID matches the class's currentTeacherUserID
          managedClass = allClasses.find(cls => cls.currentTeacherUserID === data.userID);
          
          if (managedClass) {
            setManagedClassName(managedClass.className);
          }
        }
      }

      setEnrolledSubjects(subjects);
      setProfilePicturePreview(data.profilePicture || null);

      setUserData({
        userID: data.userID,
        name: data.name || "",
        email: data.email || "",
        year: data.year ?? "",
        classID: currentClassID,
        gender: data.gender || "",
        role: data.role || [],
        profilePicture: data.profilePicture || "",
      });
    } catch (err) {
      setMessage(
        <MyMessage
          messageText="Gagal memuatkan data profil."
          messagecolor="red"
        />
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleEditClick = () => setOpenEditDialog(true);

  const handlePasswordChange = (e) =>
    setPasswordForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePasswordSubmit = async () => {
    setPasswordLoading(true);
    try {
      const res = await axiosInstance.post('/users/change-password/', passwordForm);
      setOpenPasswordDialog(false);
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage(null);
      setMessage(<MyMessage key={Date.now()} messageText={res.data.message} messagecolor="green" />);
    } catch (err) {
      setPasswordMsgKey(k => k + 1);
      setPasswordMessage({ text: parseApiError(err, 'Gagal menukar kata laluan.'), color: 'red' });
    } finally {
      setPasswordLoading(false);
    }
  };
  const handleCloseDialog = () => {
    setOpenEditDialog(false);
    setProfilePicture(null);
    setRemoveProfilePicture(false);
    setProfilePicturePreview(userData?.profilePicture || null);
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicturePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (values, { setSubmitting }) => {
    try {
      let payload = {
        name: values.name,
        gender: values.gender,
      };

      // Handle profile picture
      if (removeProfilePicture) {
        payload.profilePicture = '';
      } else if (profilePicture) {
        const base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(profilePicture);
        });
        payload.profilePicture = base64String;
      }

      // Send update request
      await axiosInstance.patch(`/users/${userData.userID}/`, payload);
      
      setMessage(
        <MyMessage key={Date.now()} messageText="Profil berjaya dikemaskini!" messagecolor="green" />
      );
      setOpenEditDialog(false);
      fetchProfile();

      // Force reload navbar to update profile picture
      window.dispatchEvent(new Event('profileUpdated'));

    } catch (err) {
      setMessage(<MyMessage key={Date.now()} messageText={parseApiError(err, "Gagal mengemaskini profil.")} messagecolor="red" />);
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
        <CircularProgress />
      </Box>
    );

  if (!userData)
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Gagal memuatkan data profil.</Typography>
      </Box>
    );

  const isStudent = userData.role.includes("Student");
  const isClassTeacher = userData.role.includes("Class Teacher");
  const isSubjectTeacher = userData.role.includes("Subject Teacher");
  const className =
    classesList.find((c) => c.classID === userData.classID)?.className || "—";

  return (
    <Box>
      <PageHeader icon={<AccountCircleIcon sx={{ color: "primary.main", fontSize: 32 }} />} title="Profil">
        <Box sx={{ display: 'flex', gap: 1 }}>
          <BackButton startIcon={<LockIcon />} onClick={() => setOpenPasswordDialog(true)}>
            Tukar Kata Laluan
          </BackButton>
          <PrimaryButton startIcon={<EditIcon />} onClick={handleEditClick}>
            Kemaskini Profil
          </PrimaryButton>
        </Box>
      </PageHeader>

      {message}

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
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Avatar
              src={profilePicturePreview}
              sx={{
                width: 150,
                height: 150,
                bgcolor: theme.palette.secondary.main,
                color: theme.palette.secondary.text,
                fontSize: 60,
                fontWeight: "bold",
              }}
            >
              {!profilePicturePreview && getInitials(userData.name)}
            </Avatar>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", gap: 4}}>
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
                    <Typography variant="body1">{userData.name || "—"}</Typography>
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
                  <Box>
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

                {isClassTeacher && !isStudent && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Kelas Diuruskan:
                    </Typography>
                    <Box
                      sx={{
                        p: 1.5,
                        bgcolor: "#f5f5f5",
                        borderRadius: 1,
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      <Typography variant="body1" color="primary">
                        {managedClassName || "—"}
                      </Typography>
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

                <Box sx={{ mb: 3 }}>
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
                      {[...userData.role].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)).map((role) => (
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
        </Box>
      </Box>

      {(isStudent || isSubjectTeacher) && (<Box
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

        {isSubjectTeacher && !isStudent && (
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
                  <Typography variant="body1" fontWeight={600} color="primary">
                    {subject.subjectName}
                  </Typography>
                  
                  {/* For teachers, show classes */}
                  {!isStudent && subject.classes && subject.classes.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} justifyContent="center">
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
              {isStudent ? "Tiada mata pelajaran diambil" : "Tiada mata pelajaran diajar"}
            </Typography>
          )}
        </Box>
      </Box>)}

      {/* ── Change Password Dialog ── */}
      <DialogBox
        open={openPasswordDialog}
        onClose={() => { setOpenPasswordDialog(false); setPasswordForm({ old_password: '', new_password: '', confirm_password: '' }); setPasswordMessage(null); setShowOld(false); setShowNew(false); setShowConfirm(false); }}
        title="Tukar Kata Laluan"
        onConfirm={handlePasswordSubmit}
        loading={passwordLoading}
        confirmLabel={passwordLoading ? 'Menyimpan...' : 'Simpan'}
        maxWidth="sm"
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {passwordMessage && (
            <MyMessage key={passwordMsgKey} messageText={passwordMessage.text} messagecolor={passwordMessage.color} />
          )}

          {/* Current password */}
          <TextField
            fullWidth
            label="Kata Laluan Semasa"
            name="old_password"
            value={passwordForm.old_password}
            onChange={handlePasswordChange}
            type={showOld ? 'text' : 'password'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowOld(p => !p)} edge="end" size="small">
                      {showOld ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            }}
          />

          <Divider />

          {/* New password */}
          <Box>
            <TextField
              fullWidth
              label="Kata Laluan Baru"
              name="new_password"
              value={passwordForm.new_password}
              onChange={handlePasswordChange}
              type={showNew ? 'text' : 'password'}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowNew(p => !p)} edge="end" size="small">
                        {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }
              }}
            />
          </Box>

          {/* Confirm password */}
          <TextField
            fullWidth
            label="Sahkan Kata Laluan Baru"
            name="confirm_password"
            value={passwordForm.confirm_password}
            onChange={handlePasswordChange}
            type={showConfirm ? 'text' : 'password'}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirm(p => !p)} edge="end" size="small">
                      {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            }}
          />
        </Box>
      </DialogBox>

      <Formik
        initialValues={userData}
        validationSchema={validationSchema}
        onSubmit={handleFormSubmit}
        enableReinitialize
      >
        {({ values, errors, touched, handleBlur, handleChange, handleSubmit, isSubmitting }) => {
          const isStudent = values.role.includes("Student");
          return (
            <DialogBox
              open={openEditDialog}
              onClose={handleCloseDialog}
              title="Kemaskini Profil"
              onConfirm={handleSubmit}
              loading={isSubmitting}
              maxWidth="sm"
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <Avatar
                    src={profilePicturePreview}
                    sx={{
                      width: 120,
                      height: 120,
                      bgcolor: theme.palette.navbar.activeBg,
                      color: theme.palette.navbar.activeText,
                      fontSize: 48,
                      fontWeight: "bold",
                    }}
                  >
                    {!profilePicturePreview && getInitials(values.name)}
                  </Avatar>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCameraIcon />}
                      sx={{ textTransform: "none" }}
                    >
                      Tukar Gambar
                      <input type="file" hidden accept="image/*" onChange={(e) => {
                        handleProfilePictureChange(e);
                        setRemoveProfilePicture(false);
                      }} />
                    </Button>
                    {profilePicturePreview && (
                      <Button
                        variant="outlined"
                        color="error"
                        sx={{ textTransform: "none" }}
                        onClick={() => {
                          setProfilePicture(null);
                          setProfilePicturePreview(null);
                          setRemoveProfilePicture(true);
                        }}
                      >
                        Padam Gambar
                      </Button>
                    )}
                  </Box>
                </Box>

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
                </Box>

              </Box>
            </DialogBox>
          );
        }}
      </Formik>
    </Box>
  );
};

export default Profile;