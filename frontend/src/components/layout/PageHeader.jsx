import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * Consistent page header used across all list/form pages.
 *
 * Props:
 *   icon     – MUI icon element (pass with sx={{ color: "primary.main" }})
 *   title    – page title string or JSX
 *   children – optional right-side slot (action buttons, selectors, etc.)
 */
const PageHeader = ({ icon, title, children }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      mb: 3,
      p: 2,
      bgcolor: "background.paper",
      borderRadius: 1,
      boxShadow: 1,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      {icon}
      <Typography variant="h6" fontWeight="bold">
        {title}
      </Typography>
    </Box>
    {children && (
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        {children}
      </Box>
    )}
  </Box>
);

export default PageHeader;
