import { useState, useEffect } from 'react';
import { decodeJwtPayload } from '../utils/helper';

import { useUIState } from './useUIState';

import { API_BASE, KLIB_KEY, GOOGLE_CLIENT_ID } from '../constants';

export const useAuth = () => {
	const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

	const { loading, setLoading, error, setError } = useUIState();

	// Derived state from token
	const payload = token ? decodeJwtPayload(token) : null;
	const isTokenValid = payload && (!payload.exp || payload.exp * 1000 >= Date.now());

	const isAdmin = isTokenValid ? (payload?.admin === true) : false;
	const userName = isTokenValid ? (payload?.name || payload?.sub || '') : '';

	const handleLogout = () => {
		localStorage.removeItem('token'); 
		setToken(null); 
	};

	// Token expiration check
	useEffect(() => {
		if (token && !isTokenValid) {
			handleLogout();
		}
	}, [token, isTokenValid]);

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault(); 
		setLoading(true); 
		setError(null);
		
		const form = new FormData(e.currentTarget);
		const id = form.get('studentId') as string;
		const pwd = form.get('password') as string;

		try {
			const formData = new URLSearchParams();
			formData.append('username', id);
			formData.append('password', pwd);

			const res = await fetch(`${API_BASE}/token`, { 
				method: 'POST', 
				headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-KLib-Key': KLIB_KEY }, 
				body: formData 
			});
			const text = await res.text();

			let data: any;
			try { data = JSON.parse(text); } 
			catch { throw new Error(`伺服器錯誤 (${res.status})`); }

			if (!res.ok) throw new Error(data.detail);
			
			localStorage.setItem('token', data.access_token); 
			setToken(data.access_token);
		} catch (err: any) { 
			setError(err.message); 
		} finally { 
			setLoading(false); 
		}
	};

	// Google Sign-In
	useEffect(() => {
		if (token || !GOOGLE_CLIENT_ID) return;

		const w = window as any;

		const initGoogle = () => {
			if (!w.google?.accounts?.id) return;

			w.google.accounts.id.initialize({
				client_id: GOOGLE_CLIENT_ID,
				callback: async (response: any) => {
					setLoading(true); 
					setError(null);

					try {
						const res = await fetch(`${API_BASE}/api/auth/google`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', 'X-KLib-Key': KLIB_KEY },
							body: JSON.stringify({ credential: response.credential })
						});
						
						const text = await res.text();
						let data: any;

						try { data = JSON.parse(text);	
						} catch { throw new Error(`伺服器錯誤 (${res.status})`); }

						if (!res.ok) throw new Error(data.detail || '請求失敗');

						localStorage.setItem('token', data.access_token); 
						setToken(data.access_token);
					} catch (err: any) { setError(err.message); 
					} finally { setLoading(false); }
				},
				hd: 'fssh.khc.edu.tw',
			});

			const container = document.getElementById('google-signin-btn');

			if (container) w.google.accounts.id.renderButton(container, {
					theme: 'outline',
					size: 'large',
					width: 380,
					text: 'signin_with',
					locale: 'zh-TW',
				});
		};
		
		if (w.google?.accounts?.id) { 
			initGoogle();
		} else { 
			const timer = setInterval(() => { 
				if (w.google?.accounts?.id) { 
					clearInterval(timer);
					initGoogle();
				} 
			}, 200); 
			return () => clearInterval(timer); 
		}
	}, [token]);

	return {
		token,
		isAdmin,
		userName,
		handleLogin,
		handleLogout,
		loading,
		error,
	};
};
