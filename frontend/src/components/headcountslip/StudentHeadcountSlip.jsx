import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Button, useTheme } from "@mui/material";
import { Print as PrintIcon, Description as SlipIcon } from "@mui/icons-material";
import { useYear } from "../../YearContext";
import HeadcountSlipContent from "../layout/HeadcountSlipContent";
import axiosInstance from "../../AxiosInstance";

const StudentHeadcountSlip = () => {
  const theme = useTheme();
  const btn = theme.palette.btn;
  const year = useYear();

  const [slipData, setSlipData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get('/student-headcount-slip/')
      .then(res => setSlipData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Memuatkan slip headcount...</Typography>
      </Box>
    );
  }

  if (!slipData) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Tiada data slip headcount</Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Page header – hidden when printing */}
      <Box
        className="no-print"
        sx={{ '@media print': { display: 'none' } }}
      >
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
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <SlipIcon sx={{ color: "primary.main" }} />
            <Typography sx={{ marginLeft: "15px", fontWeight: "bold" }} variant="h6">
              Slip Headcount
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{
              px: 3,
              background: `linear-gradient(135deg, ${btn.primary.main}, #40e0d0)`,
              color: btn.primary.text,
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { background: `linear-gradient(135deg, ${btn.primary.hover}, #3cd4c4)` },
            }}
          >
            Cetak Slip
          </Button>
        </Box>
      </Box>

      {/* Slip content */}
      <Box className="print-container">
        <Box
          sx={{
            '@media screen': { margin: "0 auto 20px auto", padding: "20px", backgroundColor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", borderRadius: 1 },
            '@media print': { margin: 0, padding: 0, boxShadow: 'none' },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              '@media print': { boxShadow: 'none', maxWidth: '100%', padding: 0, margin: 0 },
            }}
          >
            <HeadcountSlipContent slipData={slipData} year={year} />
          </Paper>
        </Box>
      </Box>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
          html, body { margin: 0; padding: 0; background: white; overflow: hidden !important; height: 100%; }
          table { page-break-inside: avoid; width: 100% !important; }
          * { overflow: visible !important; }
          tr[style*="background-color"] td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .MuiChip-root { background-color: white !important; color: black !important; border: 1px solid #ccc !important; }
          * { box-shadow: none !important; }
          tr.grade-row, tr.grade-row td { background-color: white !important; }
          tr.gpi-row, tr.gpi-row td { background-color: white !important; }
        }
      `}</style>
    </>
  );
};

export default StudentHeadcountSlip;
