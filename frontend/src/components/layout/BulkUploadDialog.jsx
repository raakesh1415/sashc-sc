/**
 * BulkUploadDialog — reusable CSV bulk-upload dialog.
 *
 * Used by TOV, ETR, AR1, AR2 pages (and can be extended to others).
 * All visual defaults come from theme.palette.btn.
 *
 * Props:
 *   open            – boolean
 *   onClose         – () => void
 *   title           – dialog title string
 *   uploadUrl       – POST endpoint  (e.g. "/bulk-upload/upload-marks/?type=tov")
 *   downloadUrl     – GET template endpoint
 *   downloadFileName – filename for the downloaded CSV
 *   instructions    – string[] shown in the "Arahan" box
 *   onSuccess       – (result) => void  called after a successful upload
 */

import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, IconButton, Stack, Button,
  Alert, List, ListItem, ListItemText, CircularProgress,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import axiosInstance from "../../AxiosInstance";
import { PrimaryButton, CancelButton } from "./Buttons";

const BulkUploadDialog = ({
  open,
  onClose,
  title,
  uploadUrl,
  downloadUrl,
  downloadFileName = "template_markah.xlsx",
  instructions = [],
  onSuccess,
}) => {
  const { palette: { btn } } = useTheme();

  const [selectedFile, setSelectedFile]   = useState(null);
  const [uploading,    setUploading]       = useState(false);
  const [downloading,  setDownloading]     = useState(false);
  const [uploadResult, setUploadResult]    = useState(null);
  const [fileError,    setFileError]       = useState("");

  const handleClose = () => {
    if (uploading) return;
    setSelectedFile(null);
    setUploadResult(null);
    setFileError("");
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      setFileError("Sila pilih fail Excel sahaja (.xlsx)");
      setSelectedFile(null);
    } else {
      setFileError("");
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axiosInstance.get(downloadUrl, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", downloadFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setFileError("Gagal memuat turun template. Sila cuba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axiosInstance.post(uploadUrl, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadResult(response.data);
      const noErrors =
        (response.data.errorCount ?? (response.data.errors?.length ?? 0)) === 0;
      onSuccess?.(response.data);
      if (noErrors) {
        setTimeout(handleClose, 2500);
      }
    } catch (error) {
      if (error.response?.status === 400) {
        setUploadResult(error.response.data);
      } else {
        setUploadResult({
          success: false,
          message: error.response?.data?.message || "Ralat semasa memuat naik. Sila cuba lagi.",
          errors: [],
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const isError   = uploadResult?.success === false;
  const isWarning = !isError && (uploadResult?.errorCount ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" fontWeight="bold">{title}</Typography>
        <IconButton onClick={handleClose} size="small" disabled={uploading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>

          {/* ── Step 1: Download template ── */}
          <Box>
            <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
              Langkah 1: Muat Turun Template
            </Typography>
            <Button
              variant="outlined"
              startIcon={downloading ? <CircularProgress size={20} /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
              fullWidth
              sx={{
                borderColor: btn.download.main,
                color: btn.download.main,
                textTransform: "none",
                "&:hover": { borderColor: btn.download.hover },
                "&:disabled": { borderColor: "#ccc", color: "#999" },
              }}
            >
              {downloading ? "Memuat turun..." : `Muat Turun Template (${downloadFileName})`}
            </Button>
          </Box>

          {/* ── Instructions ── */}
          <Box sx={{ p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>Arahan:</Typography>
            <List dense disablePadding>
              {instructions.map((text, i) => (
                <ListItem key={i} disableGutters>
                  <ListItemText primary={`• ${text}`} primaryTypographyProps={{ variant: "body2" }} />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* ── Step 2: Select & upload file ── */}
          <Box>
            <Typography variant="body2" fontWeight="600" sx={{ mb: 1 }}>
              Langkah 2: Muat Naik Fail Excel (.xlsx)
            </Typography>
            <Button
              variant="contained"
              component="label"
              startIcon={<UploadFileIcon />}
              disabled={uploading}
              fullWidth
              sx={{
                py: 1.5,
                bgcolor: selectedFile ? "success.main" : btn.primary.main,
                color: selectedFile ? "#fff" : btn.primary.text,
                textTransform: "none",
                "&:hover": { bgcolor: selectedFile ? "success.dark" : btn.primary.hover },
              }}
            >
              {selectedFile ? `Dipilih: ${selectedFile.name}` : "Pilih Fail Excel"}
              <input type="file" hidden accept=".xlsx" onChange={handleFileChange} />
            </Button>
            {fileError && (
              <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                {fileError}
              </Typography>
            )}
          </Box>

          {/* ── Upload results ── */}
          {uploadResult && (
            <Box>
              <Alert severity={isError ? "error" : isWarning ? "warning" : "success"} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight="600">{uploadResult.message}</Typography>
              </Alert>
              {uploadResult.errors?.length > 0 && (
                <Box sx={{
                  p: 2,
                  bgcolor: isError ? "#ffebee" : "#fff3cd",
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: "auto",
                  border: `1px solid ${isError ? "#ef5350" : "#ffc107"}`,
                }}>
                  <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: isError ? "#c62828" : "#856404" }}>
                    {isError ? "Ralat Pengesahan:" : "Ralat:"}
                  </Typography>
                  {uploadResult.errors.map((err, i) => (
                    <Typography key={i} variant="body2" sx={{ display: "block", color: isError ? "#c62828" : "#856404", mb: 0.5 }}>
                      • {err}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}

        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <CancelButton onClick={handleClose} disabled={uploading} sx={{ minWidth: 110, height: 36 }}>
          Tutup
        </CancelButton>
        <PrimaryButton
          onClick={handleUpload}
          startIcon={!uploading && <UploadFileIcon />}
          disabled={!selectedFile || uploading}
          sx={{ minWidth: 110, height: 36 }}
        >
          {uploading ? (
            <><CircularProgress size={16} sx={{ mr: 1, color: "white" }} />Memuat Naik...</>
          ) : "Muat Naik"}
        </PrimaryButton>
      </DialogActions>
    </Dialog>
  );
};

export default BulkUploadDialog;
