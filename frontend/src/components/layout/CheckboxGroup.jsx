import React from 'react';
import {
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox as MuiCheckbox,
  FormHelperText,
  Typography
} from '@mui/material';

const CheckboxGroup = ({ 
  label, 
  options, 
  selectedValues, 
  onChange, 
  error, 
  helperText, 
  disabled, 
  columns = 4 // default to 4 items per row
}) => {
  return (
    <FormControl component="fieldset" error={error} disabled={disabled} sx={{ width: '100%' }}>
      <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
        {label}
      </FormLabel>

      <div className="checkbox-grid" style={{ '--columns': columns }}>
        {options.map((option) => (
          <div className="checkbox-item" key={option.value}>
            <FormControlLabel
              control={
                <MuiCheckbox
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => onChange(option.value, e.target.checked)}
                  sx={{
                    color: error ? 'error.main' : 'text.secondary',
                    '&.Mui-checked': { color: 'primary.main' },
                  }}
                />
              }
              label={<Typography variant="body1">{option.label}</Typography>}
            />
          </div>
        ))}
      </div>

      {error && helperText && (
        <FormHelperText sx={{ ml: 0 }}>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default CheckboxGroup;