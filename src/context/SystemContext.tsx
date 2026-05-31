import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { View, SeatData } from '../type';
import { useAuth } from './AuthContext';
import { useUIState } from '../hooks';
import { API_BASE, KLIB_KEY } from '../constants';


interface SystemContextType {
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

	// Packed API call function
	apiCall: (endpoint: string, method?: string, body?: any) => Promise<any>;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

// Provider Componet
export function SystemProvider({ children }: { children: ReactNode }) {
	const { token } = useAuth();
	
	const { error: globalError, setError: setGlobalError } = useUIState();


	const [view, setView] = useState<View>('login');

	const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
	const [selectedBuilding, setSelectedBuilding] = useState<'新館' | '舊館'>('新館');
	const [seats, setSeats] = useState<SeatData[]>([]);
	const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([]);
	const [adminMessage, setAdminMessage] = useState<string | null>(null);

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
		view, setView,
		selectedDate, setSelectedDate,
		selectedBuilding, setSelectedBuilding,
		seats, setSeats,
		bookedSeatIds, setBookedSeatIds,

		adminMessage, setAdminMessage,
		globalError, setGlobalError,

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
