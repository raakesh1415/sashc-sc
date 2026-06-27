import React, { useState, useEffect } from 'react';
import { Alert, Collapse, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close'; 

const MyMessage = ({ messageText, messagecolor }) => {
  const [open, setOpen] = useState(true);
  const severity =
    messagecolor === 'green'  ? 'success' :
    messagecolor === 'orange' ? 'warning' : 'error';

  useEffect(() => {
    if (messageText) {
      setOpen(true);

      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        setOpen(false);
      }, 5000);

      // Cleanup timer if message changes or component unmounts
      return () => clearTimeout(timer);
    }
  }, [messageText]);

  if (!messageText) return null;

  return (
    <Box sx={{ width: '100%' }}>
      <Collapse in={open}>
        <Alert
          severity={severity}
          sx={{ mb: 2, fontWeight: 500 }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setOpen(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {messageText}
        </Alert>
      </Collapse>
    </Box>
  );
};

export default MyMessage;