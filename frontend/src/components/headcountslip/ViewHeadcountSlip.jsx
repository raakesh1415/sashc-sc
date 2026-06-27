import React, { useEffect, useState } from "react";
import { Box, Typography, Paper } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { useYear } from "../../YearContext";
import { Description as SlipIcon } from "@mui/icons-material";
import { BackButton } from "../layout/Buttons";
import HeadcountSlipContent from "../layout/HeadcountSlipContent";
import axiosInstance from "../../AxiosInstance";

const ViewHeadcountSlip = () => {
  const { userID } = useParams();
  const navigate = useNavigate();
  const year = useYear();

  const [slipData, setSlipData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userID) {
      navigate(`/${year}/headcount-slip`);
      return;
    }
    setLoading(true);
    axiosInstance.get(`/headcount-slip/${userID}/`)
      .then(res => setSlipData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userID, navigate]);

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Memuatkan slip headcount...</Typography>
      </Box>
    );
  }

  if (!slipData) return null;

  return (
    <Box>
      {/* Page header */}
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
        <BackButton onClick={() => navigate(`/${year}/headcount-slip`)} />
      </Box>

      {/* Slip content */}
      <Paper sx={{ p: 4 }}>
        <HeadcountSlipContent slipData={slipData} year={year} />
      </Paper>
    </Box>
  );
};

export default ViewHeadcountSlip;
