import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { View, SeatData, AnnouncementData } from '../type';
import { useAuth } from './AuthContext';
import { useUIState } from '../hooks';
import { API_BASE, KLIB_KEY } from '../constants';


interface SystemContextType {
	theme: 'light' | 'dark';
	toggleTheme: () => void;

	view: View;
	setView: React.Dispatch<React.SetStateAction<View>>;

	selectedDate: string;
	setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
	
	selectedBuilding: '新館' | '舊館';
	setSelectedBuilding: React.Dispatch<React.SetStateAction<'新館' | '舊館'>>;
	
	seats: SeatData[];
	setSeats: React.Dispatch<React.SetStateAction<SeatData[]>>;
	
	bookedSeatIds: number[];
	setBookedSeatIds: React.Dispatch<React.SetStateAction<number[]>>;

	adminMessage: string | null;
	setAdminMessage: React.Dispatch<React.SetStateAction<string | null>>;
	
	globalError: string | null;
	setGlobalError: React.Dispatch<React.SetStateAction<string | null>>;

	announcements: AnnouncementData[];
	setAnnouncements: React.Dispatch<React.SetStateAction<AnnouncementData[]>>;
	annTitle: string;
	setAnnTitle: React.Dispatch<React.SetStateAction<string>>;
	annContent: string;
	setAnnContent: React.Dispatch<React.SetStateAction<string>>;
	annPinned: boolean;
	setAnnPinned: React.Dispatch<React.SetStateAction<boolean>>;
	editingAnn: AnnouncementData | null;
	setEditingAnn: React.Dispatch<React.SetStateAction<AnnouncementData | null>>;

	fetchAnnouncements: () => Promise<void>;
	handleCreateAnnouncement: () => Promise<void>;
	handleUpdateAnnouncement: () => Promise<void>;
	handleDeleteAnnouncement: (id: number) => Promise<void>;

	// Packed API call function
	apiCall: (endpoint: string, method?: string, body?: any) => Promise<any>;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

// Provider Componet
export function SystemProvider({ children }: { children: ReactNode }) {
	const { token } = useAuth();
	
	const { error: globalError, setError: setGlobalError } = useUIState();

	// === View state ===
	const [view, setView] = useState<View>('login');

	// === Theme state ===
	const [theme, setTheme] = useState<'light' | 'dark'>(() => {
		const stored = localStorage.getItem('theme');
		if (stored === 'dark' || stored === 'light') return stored;
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	});
	
	useEffect(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
		if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	}, []);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	const toggleTheme = () => {
		const next = theme === 'light' ? 'dark' : 'light';
		setTheme(next);
		localStorage.setItem('theme', next);
	};

	const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
	const [selectedBuilding, setSelectedBuilding] = useState<'新館' | '舊館'>('新館');
	const [seats, setSeats] = useState<SeatData[]>([]);
	const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([]);

	const [adminMessage, setAdminMessage] = useState<string | null>(null);

	// === Announcements ===
	const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
	const [annTitle, setAnnTitle] = useState('');
	const [annContent, setAnnContent] = useState('');
	const [annPinned, setAnnPinned] = useState(false);
	const [editingAnn, setEditingAnn] = useState<AnnouncementData | null>(null);

	const fetchAnnouncements = async () => {
		try { setAnnouncements(await apiCall('/api/announcements'));
		} catch {}
	};

	const handleCreateAnnouncement = async () => {
		if (!annTitle.trim() || !annContent.trim()) { setAdminMessage('標題和內容不能為空'); return; }

		try {
			await apiCall('/api/admin/announcements', 'POST', { title: annTitle, content: annContent, is_pinned: annPinned });
			setAdminMessage('公告已發布'); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); fetchAnnouncements();
		} catch (err: any) { setAdminMessage(`發布失敗: ${err.message}`); }
	};

	const handleUpdateAnnouncement = async () => {
		if (!editingAnn) return;

		try {
			await apiCall(`/api/admin/announcements/${editingAnn.id}`, 'PUT', { title: annTitle, content: annContent, is_pinned: annPinned });
			setAdminMessage('公告已更新'); setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); fetchAnnouncements();
		} catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
	};

	const handleDeleteAnnouncement = async (id: number) => {
		if (!window.confirm('確定要刪除這則公告嗎？')) return;

		try { await apiCall(`/api/admin/announcements/${id}`, 'DELETE'); setAdminMessage('公告已刪除'); fetchAnnouncements(); 
		} catch (err: any) { setAdminMessage(`刪除失敗: ${err.message}`); }
	};

	useEffect(() => {
		if (view === 'announcements' || view === 'admin-announcements') fetchAnnouncements();
	}, [view]);

	// Clear global error and admin message on view change or when setGlobalError changes
	useEffect(() => {
		setGlobalError(null);
		setAdminMessage(null);
	}, [view, setGlobalError]);

	const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
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

			try { data = JSON.parse(text);
			} catch { throw new Error(res.ok ? text : `伺服器錯誤 (${res.status})`); }

			if (!res.ok) throw new Error(data.detail || '請求失敗');

			return data;
		} catch (err: any) { 
			setGlobalError(err.message);
			throw err; 
		}
	};

	const value: SystemContextType = {
		theme, toggleTheme,
		view, setView,
		selectedDate, setSelectedDate,
		selectedBuilding, setSelectedBuilding,
		seats, setSeats,
		bookedSeatIds, setBookedSeatIds,

		adminMessage, setAdminMessage,
		globalError, setGlobalError,

		announcements, setAnnouncements,
		annTitle, setAnnTitle,
		annContent, setAnnContent,
		annPinned, setAnnPinned,
		editingAnn, setEditingAnn,

		fetchAnnouncements,
		handleCreateAnnouncement,
		handleUpdateAnnouncement,
		handleDeleteAnnouncement,

		apiCall
	};

	return (
		<SystemContext.Provider value={value}>
			{children}
		</SystemContext.Provider>
	);
}

// Hook to use the SystemContext
export function useSystem() {
	const context = useContext(SystemContext);
	if (context === undefined)	throw new Error('useSystem must be used within a SystemProvider');

	return context;
}
