import { Calendar, ClipboardList, MessageSquare, FileText, Users, Megaphone, User, History, BookText } from 'lucide-react';
import { useUI, useAuth } from '../context';

export const BottomNav = () => {
	const { view, setView } = useUI();
	const { isAdmin } = useAuth();

	return (
		<div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] px-2 py-2 safe-bottom">
			<div className="flex items-center justify-around">
				{isAdmin ? (
					<>
						<button onClick={() => setView('admin-attendance')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-attendance' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<ClipboardList className="w-5 h-5" />
							<span className="text-[10px] mt-1">出席</span>
						</button>
						<button onClick={() => setView('admin-reservations')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-reservations' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<Calendar className="w-5 h-5" />
							<span className="text-[10px] mt-1">預約</span>
						</button>
						<button onClick={() => setView('admin-seats')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-seats' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<MessageSquare className="w-5 h-5" />
							<span className="text-[10px] mt-1">座位</span>
						</button>
						<button onClick={() => setView('admin-notes')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-notes' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<FileText className="w-5 h-5" />
							<span className="text-[10px] mt-1">註記</span>
						</button>
						<button onClick={() => setView('admin-users')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-users' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<Users className="w-5 h-5" />
							<span className="text-[10px] mt-1">學生</span>
						</button>
						<button onClick={() => setView('admin-announcements')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'admin-announcements' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
							<Megaphone className="w-5 h-5" />
							<span className="text-[10px] mt-1">公告</span>
						</button>
					</>
				) : (
					<>
						<button onClick={() => setView('myreserve')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'myreserve' ? 'text-accent font-bold' : 'text-slate-500'}`}>
							<User className="w-5 h-5" />
							<span className="text-[10px] mt-1">預約</span>
						</button>
						<button onClick={() => setView('reserve')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'reserve' ? 'text-accent font-bold' : 'text-slate-500'}`}>
							<BookText className="w-5 h-5" />
							<span className="text-[10px] mt-1">預約座位</span>
						</button>
						<button onClick={() => setView('history')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'history' ? 'text-accent font-bold' : 'text-slate-500'}`}>
							<History className="w-5 h-5" />
							<span className="text-[10px] mt-1">歷史</span>
						</button>
						<button onClick={() => setView('announcements')} className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition active:scale-95 ${view === 'announcements' ? 'text-accent font-bold' : 'text-slate-500'}`}>
							<Megaphone className="w-5 h-5" />
							<span className="text-[10px] mt-1">公告</span>
						</button>
					</>
				)}
			</div>
		</div>
	);
}
