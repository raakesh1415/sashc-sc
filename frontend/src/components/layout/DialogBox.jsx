/**
 * Reusable dialog shell used across all pages.
 *
 * Props:
 *   open          – boolean
 *   onClose       – function  (backdrop / ESC / close icon)
 *   title         – string    dialog heading
 *   subtitle      – string    optional secondary line below heading (e.g. student name)
 *   children      – ReactNode body content
 *   variant       – 'save' | 'delete' | 'none'  (default 'save')
 *                     'save'   → Batal + Simpan
 *                     'delete' → Batal + Padam
 *                     'none'   → no action row  (pass `actions` for custom buttons)
 *   onConfirm     – function  called when confirm button is clicked
 *   loading       – boolean   disables buttons and shows loading label
 *   confirmLabel  – string    override the confirm button label
 *   maxWidth      – 'xs'|'sm'|'md'|'lg'  (default 'sm')
 *   fullWidth     – boolean   (default true)
 *   error         – string    shown as Alert at the top of the content area
 *   onClearError  – function  called when the Alert × is clicked
 *   actions       – ReactNode fully-custom action area (replaces default buttons)
 */

import React from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CancelButton, SaveButton, DeleteButton } from "./Buttons";

// Override row-action constraints (minWidth/height) for dialog context
const dialogBtnSx = { minWidth: "unset", height: "unset", px: 2.5 };

const DialogBox = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  variant = "save",
  onConfirm,
  loading = false,
  confirmLabel,
  maxWidth = "sm",
  fullWidth = true,
  error,
  onClearError,
  actions,
}) => {
  const isDelete = variant === "delete";
  const defaultLabel = isDelete ? "Padam" : "Simpan";
  const loadingLabel = isDelete ? "Memadam..." : "Menyimpan...";
  const label = loading ? loadingLabel : (confirmLabel ?? defaultLabel);
  const showActions = variant !== "none" || !!actions;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          pb: 1,
        }}
      >
        <Box sx={{ pr: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ mt: 0.5, flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, fontWeight: 500 }} onClose={onClearError}>
            {error}
          </Alert>
        )}
        {children}
      </DialogContent>

      {showActions && (
        <DialogActions sx={{ px: 2.5, py: 2}}>
          {actions || (
            <>
              <CancelButton onClick={onClose} disabled={loading} sx={dialogBtnSx} />
              {isDelete ? (
                <DeleteButton onClick={onConfirm} disabled={loading} sx={dialogBtnSx}>
                  {label}
                </DeleteButton>
              ) : (
                <SaveButton onClick={onConfirm} disabled={loading} sx={dialogBtnSx}>
                  {label}
                </SaveButton>
              )}
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DialogBox;
