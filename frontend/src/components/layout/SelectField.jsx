import React from 'react';
import { TextField, MenuItem } from '@mui/material';

const SelectField = ({
  label,
  value,
  name,
  options,
  onChange,
  onBlur,
  error,
  helperText,
  disabled,
}) => {
  return (
    <TextField
      select
      sx={{width:'100%'}}
      label={label}
      variant="outlined"
      value={value}
      name={name}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      helperText={helperText}
      disabled={disabled}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default SelectField;