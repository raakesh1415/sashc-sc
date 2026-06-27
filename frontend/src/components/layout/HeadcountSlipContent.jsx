/**
 * HeadcountSlipContent
 * Shared headcount slip body: school header + student info + subjects table.
 * Used by StudentHeadcountSlip, ViewHeadcountSlip, and PrintHeadcountSlip.
 *
 * Props:
 *   slipData – headcount slip data object from the API
 *   year     – active session year (for program title)
 */

import React from "react";
import { Box, Typography, Divider, Chip } from "@mui/material";
import sasLogoImage from "../../assets/images/sas-logo.png";

// ── Grade → chip colour ───────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export const gradeColor = (grade) => {
  if (!grade) return "default";
  if (grade === "TH") return "default";
  if (["A+", "A", "A-"].includes(grade)) return "success";
  if (["B+", "B", "C+", "C"].includes(grade)) return "info";
  if (["D+", "D", "E"].includes(grade)) return "warning";
  return "error"; // G
};

const HeadcountSlipContent = ({ slipData, year }) => {
  if (!slipData) return null;

  return (
    <>
      {/* School Header */}
      <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", mb: 1, minHeight: 70 }}>
        <img
          src={sasLogoImage}
          alt="SAS Logo"
          style={{ position: "absolute", left: 0, width: 70, height: 70, objectFit: "contain" }}
        />
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6" fontWeight="bold" sx={{ letterSpacing: 1 }}>
            SEKOLAH MENENGAH ST ANTHONY
          </Typography>
          <Typography variant="body2" sx={{ letterSpacing: 0.5 }}>
            87023 WILAYAH PERSEKUTUAN LABUAN
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Typography variant="body1" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>
          PROGRAM SARANA IBU BAPA BAGI CALON SPM TAHUN {year}
        </Typography>
      </Box>

      {/* Student Info */}
      <Box sx={{ display: "flex", gap: 4, mb: 3 }}>
        <Box sx={{ flex: 2 }}>
          <Box sx={{ display: "flex", mb: 1 }}>
            <Typography sx={{ minWidth: "130px", fontWeight: 600 }}>Nama Pelajar</Typography>
            <Typography sx={{ flex: 1 }}>{slipData.studentName}</Typography>
          </Box>
          <Box sx={{ display: "flex" }}>
            <Typography sx={{ minWidth: "130px", fontWeight: 600 }}>Guru Kelas</Typography>
            <Typography sx={{ flex: 1 }}>{slipData.classTeacherName || "—"}</Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex" }}>
            <Typography sx={{ minWidth: "80px", fontWeight: 600 }}>Kelas</Typography>
            <Typography sx={{ flex: 1 }}>{slipData.className || "—"}</Typography>
          </Box>
        </Box>
      </Box>

      {/* Subjects Table */}
      <Box>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", minWidth: "40px" }}>Bil</th>
              <th style={{ border: "1px solid #ddd", padding: "12px", textAlign: "left", minWidth: "210px" }}>Mata Pelajaran</th>
              {slipData.exams && slipData.exams.map((examName, idx) => (
                <th key={idx} style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", minWidth: "120px" }}>
                  {examName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slipData.subjects && slipData.subjects.map((subject, idx) => (
              <tr key={idx}>
                <td style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #ddd", padding: "12px" }}>{subject.subjectName}</td>
                {subject.marks && subject.marks.map((mark, markIdx) => {
                  const grade = subject.grades[markIdx];
                  return (
                    <td key={markIdx} style={{ border: "1px solid #ddd", padding: "8px" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                        {grade === "TH" ? (
                          <Chip
                            label="TH"
                            size="small"
                            color="default"
                            sx={{ fontSize: 12, fontWeight: 700, minWidth: 45 }}
                          />
                        ) : mark !== null && mark !== undefined && grade ? (
                          <>
                            <Typography variant="body2" fontWeight={600} sx={{ minWidth: "30px", textAlign: "right" }}>
                              {mark != null ? Math.round(mark) : mark}
                            </Typography>
                            <Chip
                              label={grade}
                              size="small"
                              color={gradeColor(grade)}
                              sx={{ fontSize: 11, fontWeight: 700, minWidth: 40 }}
                            />
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </Box>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Grade Summary Row */}
            <tr>
              <td colSpan="2" style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", fontWeight: 600 }}>
                Gred Pencapaian
              </td>
              {slipData.gradeSummaries && slipData.gradeSummaries.map((summary, idx) => (
                <td key={idx} style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", fontSize: "0.9em" }}>
                  {summary}
                </td>
              ))}
            </tr>

            {/* GPI Row */}
            <tr>
              <td colSpan="2" style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", fontWeight: 600 }}>
                GPI
              </td>
              {slipData.gpis && slipData.gpis.map((gpi, idx) => (
                <td key={idx} style={{ border: "1px solid #ddd", padding: "12px", textAlign: "center", fontWeight: 600 }}>
                  {gpi}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Box>

      {/* Signature Section */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 5, px: 2 }}>
        {/* Calon SPM */}
        <Box sx={{ textAlign: "center", width: "28%" }}>
          <Typography variant="body2" sx={{ mb: 4 }}>Saya yang benar,</Typography>
          <Box sx={{ borderBottom: "1px dotted #333", mb: 1, mx: "auto", width: "100%", pt: 5, "@media print": { borderBottom: "1px solid #333" } }} />
          <Typography variant="body2" fontWeight="bold">( {slipData.studentName} )</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>Calon SPM</Typography>
        </Box>

        {/* Ibu Bapa / Penjaga */}
        <Box sx={{ textAlign: "center", width: "28%" }}>
          <Typography variant="body2" sx={{ mb: 4 }}>Disaksikan oleh,</Typography>
          <Box sx={{ borderBottom: "1px dotted #333", mb: 1, mx: "auto", width: "100%", pt: 5, "@media print": { borderBottom: "1px solid #333" } }} />
          <Typography variant="body2" fontWeight="bold">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>Ibu Bapa/Penjaga</Typography>
        </Box>

        {/* Pengetua */}
        <Box sx={{ textAlign: "center", width: "28%" }}>
          <Typography variant="body2" sx={{ mb: 4 }}>Diperakukan oleh,</Typography>
          <Box sx={{ borderBottom: "1px dotted #333", mb: 1, mx: "auto", width: "100%", pt: 5, "@media print": { borderBottom: "1px solid #333" } }} />
          <Typography variant="body2" fontWeight="bold">
            ( {slipData.principalName || "—"} )
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>Pengetua</Typography>
        </Box>
      </Box>
    </>
  );
};

export default HeadcountSlipContent;
