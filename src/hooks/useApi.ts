import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { API_BASE, KLIB_KEY } from '../constants';

export const useApi = () => {
    const { token } = useAuth();
    const { setGlobalError } = useUI();

    const apiCall = useCallback(async (endpoint: string, method = 'GET', body?: any) => {
        setGlobalError(null);
        const headers: any = { 'Content-Type': 'application/json', 'X-KLib-Key': KLIB_KEY };
        
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });

            const text = await res.text();
            let data: any;

            try { 
                data = JSON.parse(text); 
            } catch { 
                throw new Error(res.ok ? text : `伺服器錯誤 (${res.status})`); 
            }

            if (!res.ok) throw new Error(data.detail || '請求失敗');
            
            return data;
        } catch (err: any) {
            setGlobalError(err.message);
            throw err;
        }
    }, [token, setGlobalError]);

    return apiCall;
};
