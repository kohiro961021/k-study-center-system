import { Sun, Moon, Calendar, LogOut, User, Plus, MessageSquare, ClipboardList, History, Megaphone, Users, FileText, Clock } from 'lucide-react';
import { useUI, useAuth } from '../context/';

import { useCurrentTime } from '../hooks';

interface NavbarProps {
	theme: 'light' | 'dark';
	toggleTheme: () => void;
}

export const Navbar = ({ theme, toggleTheme }: NavbarProps) => {
	const { view, setView } = useUI();
	const { isAdmin, handleLogout } = useAuth();
	const { timeString, dateString } = useCurrentTime();

	return (
		<nav className="bg-nav/85 glass-card border-b border-slate-200 sticky top-0 z-20 shadow-sm">
			<div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

				<div className="flex items-center gap-3 font-bold text-lg text-slate-900">
					{/* Logo and Title */}
					<div className="flex items-center gap-2">
						<img src="/fssh-badge.png" alt="校徽" className="w-8 h-8 rounded-full" />
						<span className="hidden sm:inline">K書中心{isAdmin ? '管理後台' : '預約系統'}</span>
					</div>

					{/* Clock and Date */}
					<div className="hidden md:flex items-center ml-2 gap-1.5 text-sm font-medium text-slate-500 bg-slate-100 rounded-full px-3 py-1">
						<Clock className="w-3.5 h-3.5 text-slate-400" />
						<span>{dateString}</span>
						<span className="font-bold text-accent font-mono">{timeString}</span>
					</div>
				</div>

				<div className="flex items-center gap-1 text-sm">
					<div className="hidden md:flex">
						{isAdmin ? (
							<>
								<button onClick={() => setView('admin-reservations')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-reservations' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<Calendar className="w-4 h-4 inline mr-1" />預約
								</button>
								<button onClick={() => setView('admin-attendance')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-attendance' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<ClipboardList className="w-4 h-4 inline mr-1" />出席
								</button>
								<button onClick={() => setView('admin-seats')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-seats' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<MessageSquare className="w-4 h-4 inline mr-1" />座位
								</button>
								<button onClick={() => setView('admin-notes')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-notes' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<FileText className="w-4 h-4 inline mr-1" />註記
								</button>
								<button onClick={() => setView('admin-users')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-users' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<Users className="w-4 h-4 inline mr-1" />學生
								</button>
								<button onClick={() => setView('admin-announcements')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'admin-announcements' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<Megaphone className="w-4 h-4 inline mr-1" />公告
								</button>
							</>
						) : (
							<>
								<button onClick={() => setView('myreserve')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'myreserve' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<User className="w-4 h-4 inline mr-1" />我的預約
								</button>
								<button onClick={() => setView('reserve')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'reserve' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<Plus className="w-4 h-4 inline mr-1" />預約座位
								</button>
								<button onClick={() => setView('history')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'history' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<History className="w-4 h-4 inline mr-1" />歷史紀錄
								</button>
								<button onClick={() => setView('announcements')} className={`px-3 py-3.5 rounded-4xl font-medium transition ${view === 'announcements' ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
									<Megaphone className="w-4 h-4 inline mr-1" />公告
								</button>
							</>
						)}
					</div>
					
					{/* Theme Toggle and Logout */}
					<button onClick={toggleTheme} className="ml-1 p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-600" title={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}>
						{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
					</button>

					<button onClick={handleLogout} className="ml-1 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"><LogOut className="w-4 h-4" /></button>
				</div>
			</div>
		</nav>
	);
}
