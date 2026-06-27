import { useEffect, useMemo, useState } from 'react';
import { Box, Chip, Typography, Stack } from '@mui/material';
import { Link } from 'react-router-dom';
import { useYear } from '../../YearContext';
import PeopleIcon from '@mui/icons-material/People';
import AddBoxIcon from '@mui/icons-material/AddBox';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EmailIcon from '@mui/icons-material/Email';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../layout/PageHeader';
import { PrimaryButton, ViewButton, EditButton, DeleteButton } from '../layout/Buttons';
import DialogBox from '../layout/DialogBox';
import AppTable from '../layout/AppTable';
import BulkUploadDialog from '../layout/BulkUploadDialog';
import axiosInstance from '../../AxiosInstance';
import MyMessage from '../layout/Message';

const parseApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (typeof data === 'object') {
    const msgs = Object.values(data).flatMap((v) =>
      Array.isArray(v) ? v : typeof v === 'string' ? [v] : []
    );
    if (msgs.length) return msgs.join(' ');
  }
  return fallback;
};

const ROLE_COLOR = {
  Admin: 'error',
  'Subject Teacher': 'warning',
  'Class Teacher': 'info',
  Student: 'success',
};

const UserList = () => {
  const year = useYear();
  const [myData, setMyData]                   = useState([]);
  const [openDialog, setOpenDialog]           = useState(false);
  const [openAddDialog, setOpenAddDialog]     = useState(false);
  const [bulkStudentOpen, setBulkStudentOpen] = useState(false);
  const [bulkTeacherOpen, setBulkTeacherOpen] = useState(false);
  const [selectedUser, setSelectedUser]       = useState(null);
  const [message, setMessage]                 = useState(null);
  const [rowSelection, setRowSelection]       = useState({});
  const [emailDialogOpen, setEmailDialogOpen]         = useState(false);
  const [emailLoading, setEmailLoading]               = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen]           = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading]     = useState(false);

  const fetchData = () => {
    axiosInstance.get('/users/')
      .then((res) => setMyData(res.data.data || []))
      .catch(() => setMessage(<MyMessage key={Date.now()}messageText="Gagal memuatkan senarai pengguna." messagecolor="red" />));
  };

  useEffect(() => { fetchData(); }, []);

  const selectedCount = Object.keys(rowSelection).filter(k => rowSelection[k]).length;

  const selectedUserIDs = Object.keys(rowSelection)
    .filter(k => rowSelection[k])
    .map(index => myData[parseInt(index)]?.userID)
    .filter(Boolean);

  const handleDeleteClick = (user) => { setSelectedUser(user); setOpenDialog(true); };

  const handleDeleteConfirm = () => {
    axiosInstance.delete(`/users/${selectedUser.userID}/`)
      .then(() => {
        setMessage(<MyMessage key={Date.now()} messageText="Pengguna berjaya dipadam!" messagecolor="green" />);
        setOpenDialog(false);
        fetchData();
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText={parseApiError(err, 'Gagal memadam pengguna.')} messagecolor="red" />);
        setOpenDialog(false);
      });
  };

  const handleBulkDelete = () => {
    setBulkDeleteLoading(true);
    axiosInstance.post('/users/bulk-delete/', { userIDs: selectedUserIDs })
      .then((res) => {
        setBulkDeleteOpen(false);
        setRowSelection({});
        setMessage(<MyMessage key={Date.now()} messageText={res.data.message} messagecolor="green" />);
        fetchData();
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText={parseApiError(err, 'Gagal memadam pengguna.')} messagecolor="red" />);
        setBulkDeleteOpen(false);
      })
      .finally(() => setBulkDeleteLoading(false));
  };

  const handleSendCredentials = () => {
    setEmailLoading(true);
    axiosInstance.post('/users/send-credentials/', { userIDs: selectedUserIDs })
      .then((res) => {
        setEmailDialogOpen(false);
        setRowSelection({});
        setMessage(<MyMessage key={Date.now()} messageText={res.data.message} messagecolor="green" />);
      })
      .catch((err) => {
        setMessage(<MyMessage key={Date.now()} messageText={parseApiError(err, 'Gagal menghantar emel.')} messagecolor="red" />);
      })
      .finally(() => setEmailLoading(false));
  };

  const columns = useMemo(() => [
    {
      header: 'Bil',
      accessorFn: (_, index) => index + 1,
      Cell: ({ row }) => <Typography variant="body2">{row.index + 1}</Typography>,
      size: 60,
      enableSorting: false,
      enableHiding: true,
    },
    { accessorKey: 'name',  header: 'Nama' },
    { accessorKey: 'email', header: 'Emel' },
    {
      accessorKey: 'className',
      header: 'Kelas',
      size: 50,
      Cell: ({ cell }) => (
        <Typography variant="body2">{cell.getValue() || '—'}</Typography>
      ),
    },
    {
      accessorKey: 'gender',
      header: 'Jantina',
      size: 50,
      Cell: ({ cell }) => {
        const val = cell.getValue();
        const label = val === 'Male' ? 'Lelaki' : val === 'Female' ? 'Perempuan' : '—';
        return <Typography variant="body2">{label}</Typography>;
      },
    },
    {
      accessorKey: 'role',
      header: 'Peranan',
      size: 200,
      Cell: ({ cell }) => {
        const roles = cell.getValue() || [];
        return (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
            {roles.map((r) => (
              <Chip key={r} label={r} color={ROLE_COLOR[r] || 'default'} size="small" sx={{ fontWeight: 600 }} />
            ))}
          </Stack>
        );
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      size: 50,
      Cell: ({ cell }) => (
        <Chip
          label={cell.getValue() ? 'Aktif' : 'Tidak Aktif'}
          color={cell.getValue() ? 'success' : 'default'}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      ),
    },  
  ], []);

  return (
    <Box>
      <PageHeader icon={<PeopleIcon sx={{ color: 'primary.main', fontSize: 28 }} />} title="Pengurusan Pengguna">
        <PrimaryButton
          startIcon={<EmailIcon />}
          onClick={() => setEmailDialogOpen(true)}
          disabled={selectedCount === 0}
          sx={{ "&:disabled": { background: "#ccc", color: "#666" } }}
        >
          E-mel ({selectedCount})
        </PrimaryButton>
        <PrimaryButton
          startIcon={<DeleteIcon />}
          onClick={() => setBulkDeleteOpen(true)}
          disabled={selectedCount === 0}
          sx={{ "&:disabled": { background: "#ccc", color: "#666" } }}
        >
          Padam ({selectedCount})
        </PrimaryButton>
        <PrimaryButton startIcon={<AddBoxIcon />} onClick={() => setOpenAddDialog(true)}>
          Tambah Pengguna
        </PrimaryButton>
      </PageHeader>

      {message}

      <AppTable
        columns={columns}
        data={myData}
        muiTableHeadCellProps={({ column }) => ({ sx: { pl: column.getIndex() === 0 ? 3 : 1 } })}
        muiTableBodyCellProps={({ column }) => ({ sx: { pl: column.getIndex() === 0 ? 3 : 1 } })}
        enableRowSelection
        onRowSelectionChange={setRowSelection}
        getRowId={(row, index) => index.toString()}
        state={{ rowSelection }}
        renderRowActions={({ row }) => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ViewButton component={Link} to={`/${year}/users/view/${row.original.userID}`}>Lihat</ViewButton>
            <EditButton component={Link} to={`/${year}/users/edit/${row.original.userID}`}>Ubah</EditButton>
            <DeleteButton onClick={() => handleDeleteClick(row.original)}>Padam</DeleteButton>
          </Box>
        )}
      />

      {/* ── Add User Type Selection Dialog ───────────────────────────────── */}
      <DialogBox
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        title="Pilih Kaedah Tambah Pengguna"
        variant="none"
      >
        <Stack spacing={2}>
          <PrimaryButton startIcon={<PersonAddIcon />} component={Link} to={`/${year}/users/add`} fullWidth sx={{ py: 2 }}>
            Tambah Satu Pengguna
          </PrimaryButton>
          <EditButton
            startIcon={<UploadFileIcon />}
            onClick={() => { setOpenAddDialog(false); setBulkStudentOpen(true); }}
            fullWidth
            sx={{ py: 2, minWidth: "unset", height: "unset", fontSize: 14 }}
          >
            Muat Naik Pelajar
          </EditButton>
          <ViewButton
            startIcon={<UploadFileIcon />}
            onClick={() => { setOpenAddDialog(false); setBulkTeacherOpen(true); }}
            fullWidth
            sx={{ py: 2, minWidth: "unset", height: "unset", fontSize: 14, color: "#000" }}
          >
            Muat Naik Guru
          </ViewButton>
        </Stack>
      </DialogBox>

      {/* Bulk Upload — Student */}
      <BulkUploadDialog
        open={bulkStudentOpen}
        onClose={() => setBulkStudentOpen(false)}
        title="Muat Naik Pelajar Secara Pukal"
        uploadUrl="/users/upload-students/"
        downloadUrl="/users/download-student-template/"
        downloadFileName="template_pelajar.xlsx"
        instructions={[
          "Isi maklumat pelajar mengikut format template.",
          "Kolum 'Subjects': Pisahkan mata pelajaran dengan koma (cth: BM,BI,SEJ,MATH,EKO).",
          "Kolum 'Gender': Gunakan 'Male' atau 'Female'. Pastikan nama kelas dan mata pelajaran tepat seperti dalam sistem.",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
        ]}
        onSuccess={() => {
          fetchData();
          setMessage(<MyMessage key={Date.now()} messageText="Pelajar berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

      {/* Bulk Upload — Teacher */}
      <BulkUploadDialog
        open={bulkTeacherOpen}
        onClose={() => setBulkTeacherOpen(false)}
        title="Muat Naik Guru Secara Pukal"
        uploadUrl="/users/upload-teachers/"
        downloadUrl="/users/download-teacher-template/"
        downloadFileName="template_guru.xlsx"
        instructions={[
          "Isi maklumat guru mengikut format template.",
          "Kolum 'Roles': Pisahkan peranan dengan koma (cth: Subject Teacher,Admin).",
          "Kolum 'Subject Classes': Format Subject:Kelas1,Kelas2|Subject2:Kelas3 (cth: BI:5 SIRIUS,5 ADHARA|MATH:5 SIRIUS).",
          "Latar belakang KUNING = baris header. Jangan ubah atau padam baris header.",
        ]}
        onSuccess={() => {
          fetchData();
          setMessage(<MyMessage key={Date.now()} messageText="Guru berjaya dimuat naik!" messagecolor="green" />);
        }}
      />

      {/* ── Send Credentials Email Dialog ─────────────────────────────────── */}
      <DialogBox
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        title="Hantar Maklumat Log Masuk"
        onConfirm={handleSendCredentials}
        loading={emailLoading}
        maxWidth="xs"
        confirmLabel="Hantar"
      >
        <Typography sx={{ mb: 2 }}>
          Emel maklumat log masuk akan dihantar kepada <strong>{selectedCount} pengguna</strong> yang dipilih.
        </Typography>
        <Box sx={{ p: 1.5, bgcolor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 1 }}>
          <Typography variant="body2" color="warning.dark">
            Kata laluan baru yang dijana secara rawak akan ditetapkan dan dihantar kepada setiap pengguna melalui emel.
          </Typography>
        </Box>
      </DialogBox>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <DialogBox
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title="Pengesahan Padam"
        variant="delete"
        onConfirm={handleDeleteConfirm}
        maxWidth="xs"
      >
        <Typography>
          Adakah anda pasti ingin memadam item ini? Tindakan ini tidak boleh dibuat asal.
        </Typography>
        {selectedUser && (
          <Box sx={{ mt: 2, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Pengguna: <strong>{selectedUser.name}</strong>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Emel: <strong>{selectedUser.email}</strong>
            </Typography>
          </Box>
        )}
      </DialogBox>

      {/* ── Bulk Delete Confirmation Dialog ──────────────────────────────── */}
      <DialogBox
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Pengesahan Padam Bulk"
        variant="delete"
        onConfirm={handleBulkDelete}
        loading={bulkDeleteLoading}
        maxWidth="xs"
      >
        <Typography>
          Adakah anda pasti ingin memadam <strong>{selectedCount} pengguna</strong> yang dipilih? Tindakan ini tidak boleh dibuat asal.
        </Typography>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 1 }}>
          <Typography variant="body2" color="error.dark">
            Semua data berkaitan pengguna tersebut akan turut dipadam secara kekal.
          </Typography>
        </Box>
      </DialogBox>
    </Box>
  );
};

export default UserList;
