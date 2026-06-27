import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
} from "@mui/material";
import {
  Description as SlipIcon,
  Print as PrintIcon,
} from "@mui/icons-material";
import PageHeader from "../layout/PageHeader";
import { PrimaryButton, ViewButton } from "../layout/Buttons";
import AppTable from "../layout/AppTable";
import { useNavigate } from "react-router-dom";
import { useYear } from "../../YearContext";
import axiosInstance from "../../AxiosInstance";
import MyMessage from "../layout/Message";

const parseApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (typeof data === "object") {
    const msgs = Object.values(data).flatMap((v) =>
      Array.isArray(v) ? v : typeof v === "string" ? [v] : []
    );
    if (msgs.length) return msgs.join(" ");
  }
  return fallback;
};

const HeadcountSlipList = () => {
  const navigate = useNavigate();
  const year = useYear();

  const [myData, setMyData] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rowSelection, setRowSelection] = useState({});

  const GetData = useCallback(() => {
    setLoading(true);
    setMessage(null);

    axiosInstance
      .get('/headcount-slip/')
      .then((res) => {
        const data = res.data.data || [];
        setMyData(data);

        if (data.length === 0) {
          setMessage(
            <MyMessage
              messageText="Tiada data slip headcount"
              messagecolor="orange"
            />
          );
        }
      })
      .catch((err) => {
        setMessage(
          <MyMessage
            messageText={parseApiError(err, "Gagal memuatkan data slip headcount.")}
            messagecolor="red"
          />
        );
        setMyData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    GetData();
  }, [GetData]);

  const handlePrintSlips = () => {
    const selectedRows = Object.keys(rowSelection).filter(key => rowSelection[key]);

    if (selectedRows.length === 0) {
      setMessage(
        <MyMessage
          messageText="Sila pilih sekurang-kurangnya satu pelajar"
          messagecolor="orange"
        />
      );
      return;
    }

    // Get selected student IDs
    const selectedStudentIds = selectedRows.map(index => myData[parseInt(index)].userID);

    // Navigate to print view with selected students
    navigate(`/${year}/headcount-slip/print`, {
      state: {
        studentIds: selectedStudentIds
      }
    });
  };

  const handleViewSlip = (userID) => {
    navigate(`/${year}/headcount-slip/view/${userID}`);
  };

  const columns = useMemo(
    () => [
      {
        header: "Bil",
        accessorFn: (_, index) => index + 1,
        id: "bil",
        enableEditing: false,
        enableSorting: false,
        size: 50,
      },
      {
        accessorKey: "studentName",
        header: "Pelajar",
        enableEditing: false,
        enableSorting: true,
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue()}
          </Typography>
        ),
      },
      {
        accessorKey: "className",
        header: "Kelas",
        enableEditing: false,
        enableSorting: true,
        size: 80,
        Cell: ({ cell }) => (
          <Typography variant="body2">
            {cell.getValue() || "—"}
          </Typography>
        ),
      },
    ],
    []
  );

  return (
    <Box>
      <PageHeader
        icon={<SlipIcon sx={{ color: "primary.main" }} />}
        title="Slip Headcount"
      >
        <PrimaryButton
          startIcon={<PrintIcon />}
          onClick={handlePrintSlips}
          disabled={Object.keys(rowSelection).length === 0}
          sx={{
            "&:disabled": {
              background: "#ccc",
              color: "#666",
            },
          }}
        >
          Cetak Slip ({Object.keys(rowSelection).filter(k => rowSelection[k]).length})
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        columns={columns}
        data={myData}
        loading={loading}
        actionsColumnSize={100}
        enableRowSelection
        onRowSelectionChange={setRowSelection}
        getRowId={(row, index) => index.toString()}
        state={{ rowSelection }}
        renderRowActions={({ row }) => (
          <ViewButton onClick={() => handleViewSlip(row.original.userID)}>
            Lihat
          </ViewButton>
        )}
      />
    </Box>
  );
};

export default HeadcountSlipList;
