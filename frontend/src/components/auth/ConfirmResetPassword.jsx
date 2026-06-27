import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useYear } from "../../YearContext";
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import Visibility    from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";
import sasLogoImage from "../../assets/images/sas-logo.png";
import resetPasswordImage from "../../assets/images/resetpassword.jpg";

const ConfirmResetPassword = () => {
  const navigate = useNavigate();
  const year = useYear();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [msgKey, setMsgKey] = useState(0);
  const redirectTimer = useRef(null);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Pautan tidak sah atau telah tamat tempoh");
        setValidating(false);
        return;
      }

      try {
        await axiosInstance.post("/password-reset/validate-token/", { token });
        setTokenValid(true);
      } catch (err) {
        setError("Pautan tidak sah atau telah tamat tempoh");
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError("Sila masukkan kata laluan");
      setMsgKey(k => k + 1);
      return;
    }

    if (newPassword.length < 8) {
      setError("Kata laluan mestilah sekurang-kurangnya 8 aksara");
      setMsgKey(k => k + 1);
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Kata laluan mestilah mengandungi sekurang-kurangnya satu huruf besar");
      setMsgKey(k => k + 1);
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("Kata laluan mestilah mengandungi sekurang-kurangnya satu huruf kecil");
      setMsgKey(k => k + 1);
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("Kata laluan mestilah mengandungi sekurang-kurangnya satu nombor");
      setMsgKey(k => k + 1);
      return;
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      setError("Kata laluan mestilah mengandungi sekurang-kurangnya satu aksara khas (!@#$%^&*)");
      setMsgKey(k => k + 1);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Kata laluan tidak sepadan");
      setMsgKey(k => k + 1);
      return;
    }

    setLoading(true);

    try {
      await axiosInstance.post("/password-reset/confirm/", {
        token: token,
        new_password: newPassword,
      });

      setSuccess("Kata laluan berjaya ditukar! Anda akan dibawa ke halaman log masuk.");
      setMsgKey(k => k + 1);
      redirectTimer.current = setTimeout(() => navigate(`/${year}/login`), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal menukar kata laluan. Sila cuba lagi.");
      setMsgKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #00ffef, #40e0d0)",
        }}
      >
        <CircularProgress sx={{ color: "white" }} />
      </Box>
    );
  }

  if (!tokenValid) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #00ffef, #40e0d0)",
          p: 2,
        }}
      >
        <Card
          sx={{
            maxWidth: 500,
            p: 5,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            borderRadius: 4,
          }}
        >
          <Typography variant="h5" fontWeight="bold" color="error" mb={2}>
            Pautan Tidak Sah
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate(`/${year}/reset-password`)}
            sx={{
              fontWeight: 600,
              color: "#000",
              bgcolor: "#00ffef",
              "&:hover": { bgcolor: "#00e6d8" },
            }}
          >
            Minta Pautan Baru
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #00ffef, #40e0d0)",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 1000,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          borderRadius: 4,
        }}
      >
        {/* Left image */}
        <Box
          sx={{
            flex: 1,
            display: { xs: "none", sm: "flex" },
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            backgroundColor: "#fff",
          }}
        >
          <img
            src={resetPasswordImage}
            alt="Password Reset Illustration"
            style={{ width: "100%", objectFit: "cover" }}
          />
        </Box>

        {/* Right form */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 4, sm: 6 },
            bgcolor: "#fafafa",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <img
              src={sasLogoImage}
              alt="SAS Logo"
              style={{ height: 90, marginBottom: 12 }}
            />
            <Typography variant="subtitle1" fontWeight="bold">
              SEKOLAH MENENGAH ST. ANTHONY WP LABUAN
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ mt: 4, mb: 1 }}>
              Tetapkan Kata Laluan Baru
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sesi {year}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Masukkan kata laluan baru untuk akaun anda
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              label="Kata Laluan Baru"
              placeholder="Masukkan kata laluan baru"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              slotProps={{ input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label={
                        showPassword
                          ? "Sembunyikan kata laluan"
                          : "Tunjukkan kata laluan"
                      }
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}}
            />

            <TextField
              fullWidth
              type={showConfirmPassword ? "text" : "password"}
              label="Sahkan Kata Laluan"
              placeholder="Masukkan semula kata laluan"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              sx={{ mb: 4 }}
              slotProps={{ input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                      aria-label={
                        showConfirmPassword
                          ? "Sembunyikan kata laluan"
                          : "Tunjukkan kata laluan"
                      }
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}}
            />

            {error && <MyMessage key={msgKey} messageText={error} messagecolor="red" />}
            {success && <MyMessage key={msgKey} messageText={success} messagecolor="green" />}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.5,
                fontWeight: 600,
                color: "#000",
                bgcolor: "#00ffef",
                "&:hover": { bgcolor: "#00e6d8" },
              }}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Menyimpan...
                </>
              ) : (
                "Tetapkan Kata Laluan"
              )}
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default ConfirmResetPassword;