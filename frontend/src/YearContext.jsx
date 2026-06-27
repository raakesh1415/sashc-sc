import { createContext, useContext } from 'react';

const DEFAULT_YEAR = String(new Date().getFullYear());

export const YearContext = createContext(DEFAULT_YEAR);
export const useYear = () => useContext(YearContext);
export { DEFAULT_YEAR };
