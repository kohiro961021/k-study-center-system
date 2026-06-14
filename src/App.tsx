import { useEffect } from 'react';
import { useUI } from './context';
import { AlertCircle } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navbar, BottomNav } from './components';

import { 
	LoginView, 
	MyReserveView, HistoryView, ReserveView, AnnouncementView, QRCodeView,
	AdminAnnouncementView, AttendanceView, NoteView, ResManageView, SeatView, UserManageView, ScannerView
} from './views';

export default function App() {
	const { token, isAdmin } = useAuth();
	const {
		view, setView,
		globalError, setGlobalError
	} = useUI();

	// 🏴 Easter egg console hint
	useEffect(() => {
		console.log("%c🔍 致好奇的你", "color:#00ff41;font-size:16px;font-weight:bold;");
		console.log("%c如果你正在讀這段文字，也許你就是我們要找的人。", "color:#888;font-size:12px;");
		console.log("%c→ GET /api/.easter-egg", "color:#0af;font-size:12px;");
	}, []);

	useEffect(() => {
		if (token) {
			setView(isAdmin ? 'admin-attendance' : 'announcements');
		} else {
			setView('login');
		}
	}, [token, isAdmin]);

  	// === Login Page ===
	if (!token)	return <LoginView />;

  	// === Main App ===
  	return (
		<div className="min-h-screen bg-page noise-bg font-sans">
			<Navbar />

			<main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6 space-y-6">
				{/* Global Error Banner */}
				{globalError && (
					<div className="p-4 bg-red-50 text-red-800 text-sm rounded-xl border border-red-200 flex items-center justify-between shadow-sm">
						<div className="flex items-center gap-2">
							<AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
							<span>{globalError}</span>
						</div>
						<button onClick={() => setGlobalError(null)} className="text-red-600 hover:text-red-800 font-bold ml-4">✕</button>
					</div>
				)}

				{/* Admin Views */}
				{view === 'admin-reservations' && <ResManageView />}
				{view === 'admin-attendance' && <AttendanceView />}
				{view === 'admin-notes' && <NoteView />}
				{view === 'admin-seats' && <SeatView />}
				{view === 'admin-users' && <UserManageView />}
				{view === 'admin-announcements' && <AdminAnnouncementView />}
				{view === 'admin-scanner' && <ScannerView />}

				{/* Student Views */}
				{view === 'myreserve' && <MyReserveView />}
				{view === 'history' && <HistoryView />}
				{view === 'reserve' && <ReserveView />}
				{view === 'announcements' && <AnnouncementView />}
				{view === 'qrcode' && <QRCodeView />}
			</main>

			<BottomNav />
		</div>
	);
}