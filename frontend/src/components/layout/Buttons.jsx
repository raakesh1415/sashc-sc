/**
 * Shared button components.
 * All buttons derive colours from theme.palette.btn so design changes
 * only need to be made in one place.
 *
 * Exports:
 *   PrimaryButton  – gradient header/action button (e.g. "Tambah X")
 *   BackButton     – btn.back  / ArrowBackIcon   / "Kembali"
 *   ViewButton     – btn.view  / VisibilityIcon  / "Lihat"
 *   EditButton     – btn.edit  / EditIcon        / "Ubah"
 *   DeleteButton   – btn.delete / DeleteIcon     / "Padam"
 *   SaveButton     – btn.save  / CheckIcon       / "Simpan"
 *   CancelButton   – btn.cancel / CloseIcon      / "Batal"
 *
 * All row-action / table-icon buttons share: size="small", minWidth 85 px,
 * height 32 px.  Override via the sx prop if needed.
 */

import React from "react";
import { Button, useTheme } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// ── shared defaults for row-action / table-icon buttons ──────────────────────
const rowSx = {
  textTransform: "none",
  fontWeight: 600,
  minWidth: "85px",
  height: "32px",
};

// ── PrimaryButton ─────────────────────────────────────────────────────────────
export const PrimaryButton = ({ children, startIcon, sx, ...props }) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      startIcon={startIcon}
      sx={[
        {
          background: `linear-gradient(135deg, ${btn.primary.main}, ${btn.primary.gradient})`,
          color: btn.primary.text,
          fontWeight: 600,
          textTransform: "none",
          "&:hover": {
            background: `linear-gradient(135deg, ${btn.primary.hover}, ${btn.primary.gradient})`,
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── BackButton ────────────────────────────────────────────────────────────────
export const BackButton = ({
  children = "Kembali",
  startIcon = <ArrowBackIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      startIcon={startIcon}
      sx={[
        {
          bgcolor: btn.back.main,
          color: btn.back.text,
          fontWeight: 600,
          textTransform: "none",
          "&:hover": { bgcolor: btn.back.hover },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── ViewButton ────────────────────────────────────────────────────────────────
export const ViewButton = ({
  children = "Lihat",
  startIcon = <VisibilityIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={startIcon}
      sx={[
        { bgcolor: btn.view.main, color: btn.view.text, "&:hover": { bgcolor: btn.view.hover }, ...rowSx },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── EditButton ────────────────────────────────────────────────────────────────
export const EditButton = ({
  children = "Ubah",
  startIcon = <EditIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={startIcon}
      sx={[
        { bgcolor: btn.edit.main, color: btn.edit.text, "&:hover": { bgcolor: btn.edit.hover }, ...rowSx },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── DeleteButton ──────────────────────────────────────────────────────────────
export const DeleteButton = ({
  children = "Padam",
  startIcon = <DeleteIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={startIcon}
      sx={[
        { bgcolor: btn.delete.main, color: btn.delete.text, "&:hover": { bgcolor: btn.delete.hover }, ...rowSx },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── SaveButton ────────────────────────────────────────────────────────────────
export const SaveButton = ({
  children = "Simpan",
  startIcon = <CheckIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={startIcon}
      sx={[
        { bgcolor: btn.save.main, color: btn.save.text, "&:hover": { bgcolor: btn.save.hover }, ...rowSx },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// ── CancelButton ──────────────────────────────────────────────────────────────
export const CancelButton = ({
  children = "Batal",
  startIcon = <CloseIcon />,
  sx,
  ...props
}) => {
  const { palette: { btn } } = useTheme();
  return (
    <Button
      variant="contained"
      size="small"
      startIcon={startIcon}
      sx={[
        { bgcolor: btn.cancel.main, color: btn.cancel.text, "&:hover": { bgcolor: btn.cancel.hover }, ...rowSx },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};
