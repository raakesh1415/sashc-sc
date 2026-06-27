import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useYear } from "../../YearContext";
import {
  Box,
  Card,
  TextField,
  Button,
  Typography,
  InputAdornment,
  CircularProgress,
  Link,
} from "@mui/material";
import axiosInstance from "../../AxiosInstance";
import { toFullEmail } from "../../constants";
import MyMessage from "../layout/Message";
import sasLogoImage from "../../assets/images/sas-logo.png";
import resetPasswordImage from "../../assets/images/resetpassword.jpg";

const ResetPassword = () => {
  const navigate = useNavigate();
  const year = useYear();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [msgKey, setMsgKey] = useState(0);
  const redirectTimer = useRef(null);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError("Sila masukkan emel anda");
      setMsgKey(k => k + 1);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const fullEmail = toFullEmail(email);

      await axiosInstance.post("/password-reset/request/", {
        email: fullEmail,
        year,
      });

      setSuccess("Pautan tetapan semula kata laluan telah dihantar ke emel anda. Sila semak inbox anda.");
      setMsgKey(k => k + 1);
      setEmail("");
      redirectTimer.current = setTimeout(() => navigate(`/${year}/login`), 3000);
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Emel tidak dijumpai dalam sistem");
      } else if (err.response?.status === 400) {
        setError("Sila masukkan emel yang sah");
      } else {
        setError(err.response?.data?.message || "Gagal menghantar emel. Sila cuba lagi.");
      }
      setMsgKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

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
            alt="Reset Password Illustration"
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
              Lupa Kata Laluan
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Sesi {year}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Masukkan emel DELIMa untuk menerima pautan reset
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Emel"
              placeholder="Masukkan emel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 4 }}
              slotProps={{ input: {
                endAdornment: !email.includes('@') ? (
                  <InputAdornment position="end">
                    <Typography variant="body2" color="text.secondary">@moe-dl.edu.my</Typography>
                  </InputAdornment>
                ) : null,
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
                  Menghantar...
                </>
              ) : (
                "Hantar Pautan Tetapan Semula"
              )}
            </Button>

            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Link
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                onClick={() => navigate(`/${year}/login`)}
                sx={{ color: "#000" }}
              >
                Kembali ke halaman log masuk
              </Link>
            </Box>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default ResetPassword;