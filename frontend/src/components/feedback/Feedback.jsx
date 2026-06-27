import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip,
  Tabs, Tab, Divider, CircularProgress, useTheme, Checkbox, Tooltip,
} from '@mui/material';
import {
  MarkEmailRead   as MarkReadIcon,
  MarkEmailUnread as MarkUnreadIcon,
  Inbox           as InboxIcon,
  Email           as EmailIcon,
  Person          as PersonIcon,
  AccessTime      as TimeIcon,
  DoneAll         as DoneAllIcon,
  Delete          as DeleteIcon,
} from '@mui/icons-material';
import axiosInstance from '../../AxiosInstance';
import PageHeader from '../layout/PageHeader';
import { PrimaryButton, DeleteButton, CancelButton } from '../layout/Buttons';
import DialogBox from '../layout/DialogBox';
import MyMessage from '../layout/Message';

const FeedbackInbox = () => {
  const theme = useTheme();
  const { secondary, btn } = theme.palette;

  const [feedbacks, setFeedbacks]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState(0);
  const [expanded, setExpanded]             = useState(null);
  const [selectedIDs, setSelectedIDs]       = useState(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [message, setMessage]               = useState(null);

  const fetchFeedbacks = async () => {
    try {
      const res = await axiosInstance.get('/feedback/');
      setFeedbacks(res.data.data || []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeedbacks(); }, []);

  const handleToggleRead = async (fb) => {
    try {
      const res = await axiosInstance.patch(`/feedback/${fb.feedbackID}/`, { is_read: !fb.is_read });
      setFeedbacks(prev => prev.map(f => f.feedbackID === fb.feedbackID ? res.data.data : f));
      window.dispatchEvent(new Event('feedbackUpdated'));
    } catch { /* ignore */ }
  };

  const handleDelete = async (feedbackID) => {
    try {
      await axiosInstance.delete(`/feedback/${feedbackID}/`);
      setFeedbacks(prev => prev.filter(f => f.feedbackID !== feedbackID));
      setSelectedIDs(prev => { const s = new Set(prev); s.delete(feedbackID); return s; });
      if (expanded === feedbackID) setExpanded(null);
      window.dispatchEvent(new Event('feedbackUpdated'));
    } catch { /* ignore */ }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const res = await axiosInstance.post('/feedback/bulk-delete/', { feedbackIDs: [...selectedIDs] });
      setFeedbacks(prev => prev.filter(f => !selectedIDs.has(f.feedbackID)));
      if (selectedIDs.has(expanded)) setExpanded(null);
      setSelectedIDs(new Set());
      setBulkDeleteOpen(false);
      setMessage(<MyMessage key={Date.now()} messageText={res.data.message} messagecolor="green" />);
      window.dispatchEvent(new Event('feedbackUpdated'));
    } catch {
      setMessage(<MyMessage key={Date.now()} messageText="Gagal memadam maklum balas." messagecolor="red" />);
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExpand = async (fb) => {
    const isClosing = expanded === fb.feedbackID;
    setExpanded(isClosing ? null : fb.feedbackID);
    if (isClosing && !fb.is_read) {
      try {
        const res = await axiosInstance.patch(`/feedback/${fb.feedbackID}/`, { is_read: true });
        setFeedbacks(prev => prev.map(f => f.feedbackID === fb.feedbackID ? res.data.data : f));
        window.dispatchEvent(new Event('feedbackUpdated'));
      } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await Promise.all(
        feedbacks.filter(f => !f.is_read).map(f =>
          axiosInstance.patch(`/feedback/${f.feedbackID}/`, { is_read: true })
        )
      );
      await fetchFeedbacks();
      window.dispatchEvent(new Event('feedbackUpdated'));
    } catch { /* ignore */ }
  };

  const handleCheckbox = (e, feedbackID) => {
    e.stopPropagation();
    setSelectedIDs(prev => {
      const s = new Set(prev);
      s.has(feedbackID) ? s.delete(feedbackID) : s.add(feedbackID);
      return s;
    });
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (selectedIDs.size === filtered.length) {
      setSelectedIDs(new Set());
    } else {
      setSelectedIDs(new Set(filtered.map(f => f.feedbackID)));
    }
  };

  const unreadCount = feedbacks.filter(f => !f.is_read).length;
  const selectedCount = selectedIDs.size;

  const filtered = feedbacks.filter(f => {
    if (tab === 1) return !f.is_read;
    if (tab === 2) return f.is_read;
    return true;
  });

  const allSelected = filtered.length > 0 && selectedCount === filtered.length;
  const someSelected = selectedCount > 0 && selectedCount < filtered.length;

  const formatDate = (iso) =>
    new Date(iso).toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Box>
      <PageHeader
        icon={<InboxIcon sx={{ color: 'primary.main' }} />}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Maklum Balas
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} belum dibaca`}
                size="small"
                sx={{ bgcolor: secondary.main, fontWeight: 600, fontSize: 11 }}
              />
            )}
          </Box>
        }
      >
        {unreadCount > 0 && (
          <PrimaryButton startIcon={<DoneAllIcon />} onClick={handleMarkAllRead}>
            Semua Dibaca
          </PrimaryButton>
        )}

        <PrimaryButton
          startIcon={<DeleteIcon />}
          onClick={() => setBulkDeleteOpen(true)}
          disabled={selectedCount === 0}
          sx={{ '&:disabled': { background: '#ccc', color: '#666' } }}
        >
          Padam ({selectedCount})
        </PrimaryButton>
      </PageHeader>

      {message}

      {/* Tabs */}
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1, mb: 2, display: 'flex', alignItems: 'center', px: 2 }}>
        <Tooltip title={allSelected ? 'Clear Selection' : 'Select All'} placement="top">
          <span>
            <Checkbox
              indeterminate={someSelected}
              checked={allSelected}
              onChange={handleSelectAll}
              size="medium"
              disabled={filtered.length === 0}
              sx={{ p: 1 }}
            />
          </span>
        </Tooltip>
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setSelectedIDs(new Set()); }}
          sx={{
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: 14 },
            '& .Mui-selected': { color: 'text.primary' },
            '& .MuiTabs-indicator': { bgcolor: secondary.main },
          }}
        >
          <Tab label={`Semua (${feedbacks.length})`} />
          <Tab label={`Belum Dibaca (${unreadCount})`} />
          <Tab label={`Sudah Dibaca (${feedbacks.length - unreadCount})`} />
        </Tabs>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box
          sx={{
            bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', py: 8, gap: 1,
          }}
        >
          <InboxIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
          <Typography color="text.secondary">Tiada maklum balas</Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filtered.map((fb) => {
              const isOpen     = expanded === fb.feedbackID;
              const isSelected = selectedIDs.has(fb.feedbackID);
              return (
                <Card
                  key={fb.feedbackID}
                  elevation={fb.is_read ? 1 : 2}
                  sx={{
                    borderRadius: 1,
                    borderLeft: `4px solid ${isSelected ? btn.primary.main : fb.is_read ? 'transparent' : secondary.main}`,
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s',
                    bgcolor: isSelected ? 'action.selected' : 'background.paper',
                    '&:hover': { boxShadow: 3 },
                  }}
                  onClick={() => handleExpand(fb)}
                >
                  <CardContent sx={{ pb: isOpen ? 1 : '16px !important' }}>
                    {/* Top row */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                        {/* Checkbox */}
                        <Checkbox
                          size="medium"
                          checked={isSelected}
                          onChange={(e) => handleCheckbox(e, fb.feedbackID)}
                          onClick={(e) => e.stopPropagation()}
                          sx={{ p: 0.5, flexShrink: 0 }}
                        />
                        {!fb.is_read && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: btn.primary.hover, flexShrink: 0, mt: 0.3 }} />
                        )}
                        <Typography fontWeight={fb.is_read ? 500 : 700} variant="body1" noWrap>
                          {fb.title}
                        </Typography>
                      </Box>

                      {/* Action buttons */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
                        onClick={e => e.stopPropagation()}
                      >
                        {fb.is_read
                          ? <CancelButton startIcon={<MarkUnreadIcon />} onClick={() => handleToggleRead(fb)}>Belum Dibaca</CancelButton>
                          : <PrimaryButton startIcon={<MarkReadIcon />} onClick={() => handleToggleRead(fb)} sx={{ fontSize: 12 }}>Sudah Dibaca</PrimaryButton>
                        }
                        <DeleteButton onClick={() => handleDelete(fb.feedbackID)} />
                      </Box>
                    </Box>

                    {/* Meta row */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5, pl: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{fb.name}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{fb.email}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">{formatDate(fb.created_at)}</Typography>
                      </Box>
                    </Box>

                    {/* Expanded message */}
                    {isOpen && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'text.primary', pl: 4 }}>
                          {fb.description}
                        </Typography>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </>
      )}

      {/* Bulk Delete Dialog */}
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
          Adakah anda pasti ingin memadam <strong>{selectedCount} maklum balas</strong> yang dipilih? Tindakan ini tidak boleh dibuat asal.
        </Typography>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 1 }}>
          <Typography variant="body2" color="error.dark">
            Semua maklum balas yang dipilih akan turut dipadam secara kekal.
          </Typography>
        </Box>
      </DialogBox>
    </Box>
  );
};

export default FeedbackInbox;
