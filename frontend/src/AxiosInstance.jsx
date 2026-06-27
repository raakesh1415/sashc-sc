import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

export const STORAGE_KEYS = {
    ACCESS_TOKEN:  'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ROLES:    'userRoles',
    USER_EMAIL:    'userEmail',
    ACTIVE_YEAR:   'activeYear',
};

const AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Shared refresh promise — ensures only one token refresh runs at a time.
// All concurrent 401s wait on the same promise instead of each triggering a refresh.
let _refreshPromise = null;

// Request interceptor
AxiosInstance.interceptors.request.use(
    function (config){
        const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        // Append active academic year to all requests
        const activeYear = localStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR);
        if (activeYear) {
            config.params = { ...config.params, year: activeYear };
        }
        return config;
    }, 
    function (error){
        return Promise.reject(error);
    }
);

// Response interceptor
AxiosInstance.interceptors.response.use(
    function (response){
        // console.log("Response Interceptor called:", response);
        return response;
    }, 
    // Handle failed responses / errors
    async function (error){
        const originalRequest = error.config;
        const responseStatus = error.response?.status;

        // Only attempt token refresh on 401 and only once per request
        if (responseStatus === 401 && !originalRequest._retried){
            originalRequest._retried = true;
            const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
            if (!refreshToken) {
                return Promise.reject(error);
            }
            try {
                // Re-use an in-flight refresh if one is already running (race condition fix)
                if (!_refreshPromise) {
                    _refreshPromise = AxiosInstance.post('/token/refresh/', { refresh: refreshToken })
                        .finally(() => { _refreshPromise = null; });
                }
                const response = await _refreshPromise;
                const newAccess = response.data.access;
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccess);
                if (response.data.refresh) {
                    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refresh);
                }
                originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
                return AxiosInstance(originalRequest);
            } catch {
                // Refresh failed — clear all auth state and redirect to login
                const year = localStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR) || new Date().getFullYear();
                Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
                window.location.href = `/${year}/login`;
            }
        }
        return Promise.reject(error);
    }
);

export default AxiosInstance;