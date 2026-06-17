import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit3, X, UserPlus, Check, XCircle, Wrench, CheckCircle2, Save, AlertCircle } from 'lucide-react';
import { useApi } from '../../hooks';
import { useSeats } from '../../context';
import { SeatLegend, SeatMap, DatePicker, RefreshButton } from '../../components';
import { AdminReservation, SeatData } from '../../type';

export function SeatView() {
    const apiCall = useApi();

    const { 
        selectedDate, setSelectedDate,
        selectedBuilding, setSelectedBuilding,
        seats, setSeats,
        bookedSeatIds, setBookedSeatIds 
    } = useSeats();
    
    const [allReservations, setAllReservations] = useState<AdminReservation[]>([]);
    
    // 整合式座位管理 Modal 狀態
    const [activeSeat, setActiveSeat] = useState<SeatData | null>(null);
    const [noteText, setNoteText] = useState('');
    const [adminReserveStudentId, setAdminReserveStudentId] = useState('');
    const [adminReserveDate, setAdminReserveDate] = useState(() => {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const tz8 = new Date(utc + 8 * 3600000);
        const y = tz8.getUTCFullYear();
        const m = String(tz8.getUTCMonth() + 1).padStart(2, '0');
        const d = String(tz8.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });

    const fetchSeats = async () => { try { setSeats(await apiCall('/api/seats')); } catch { } };
    const fetchAvailability = async () => { try { setBookedSeatIds(await apiCall(`/api/availability?res_date=${selectedDate}`)); } catch { } };
    const fetchAdminReservations = async () => { try { setAllReservations(await apiCall(`/api/admin/reservations?date=${selectedDate}`)); } catch { } };

    useEffect(() => {
        fetchSeats();
        fetchAvailability();
        fetchAdminReservations();
    }, [selectedDate]);

    // 開啟整合式 Modal
    const handleSeatClick = (seat: SeatData) => {
        setActiveSeat(seat);
        setNoteText(seat.note || '');
        setAdminReserveStudentId('');
        setAdminReserveDate(selectedDate);
    };

    const closeModal = () => setActiveSeat(null);

    const refreshAll = () => {
        fetchSeats();
        fetchAvailability();
        fetchAdminReservations();
    };

    // API
    const handleUpdateAttendance = async (reservationId: number, status: 'present' | 'absent') => {
        try {
            const result = await apiCall(`/api/admin/reservations/${reservationId}/attendance`, 'PUT', { status });
            alert(result.message);
            refreshAll();
            closeModal();
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
    };

    const handleSeatStatus = async (seatId: number, newStatus: 'maintenance' | 'available') => {
        const action = newStatus === 'maintenance' ? '設為維修中（會自動取消該座位未來的所有預約）' : '恢復為可用';
        if (!window.confirm(`確定要${action}嗎？`)) return;
        try {
            const result = await apiCall(`/api/admin/seats/${seatId}/status`, 'PUT', { status: newStatus });
            alert(result.message);
            refreshAll();
            closeModal();
        } catch (err: any) { alert(`操作失敗: ${err.message}`); }
    };

    const handleReserve = async (seatId: number) => {
        if (!window.confirm('確定要預約這個座位嗎？')) return;
        try { 
            await apiCall('/api/reserve', 'POST', { seat_id: seatId, res_date: selectedDate }); 
            alert('預約成功！'); 
            refreshAll();
        } catch (err: any) { alert(`預約失敗: ${err.message}`); }
    };

    const handleSaveSeatNote = async () => {
        if (!activeSeat) return;
        try { 
            await apiCall(`/api/admin/seats/${activeSeat.id}/note`, 'PUT', { note: noteText });
            alert('註記已更新');
            refreshAll();
            // 更新 activeSeat 的 note 而不關閉 modal
            setActiveSeat({ ...activeSeat, note: noteText || null });
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
    };

    const handleAdminReserve = async () => {
        if (!activeSeat || !adminReserveStudentId) return;
        try { 
            const result = await apiCall('/api/admin/reserve', 'POST', { student_id: adminReserveStudentId, seat_id: activeSeat.id, res_date: adminReserveDate }, false); 
            alert(result.message);
            refreshAll();
            closeModal();
        } catch (err: any) { alert(`預約失敗: ${err.message}`); }
    };

    // Get seat status info for modal display
    const getSeatStatusInfo = (seat: SeatData) => {
        const isBooked = bookedSeatIds.includes(seat.id);
        const isMaint = seat.status === 'maintenance';
        const isStaff = seat.seat_type === 'staff';
        const reservation = allReservations.find(r => r.seat_id === seat.id && r.res_date === selectedDate);

        if (isMaint) return { label: '維修中', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', icon: Wrench };
        if (isStaff) return { label: '工讀生', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertCircle };
        if (isBooked && reservation) return { label: `已預約 — ${reservation.student_name || reservation.student_id}`, color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle };
        if (isBooked) return { label: '已預約', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle };
        return { label: '空位', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
    };

    // 整合式座位管理 Modal
    const renderAdminModal = () => {
        if (!activeSeat) return null;

        const statusInfo = getSeatStatusInfo(activeSeat);
        const StatusIcon = statusInfo.icon;
        const isBooked = bookedSeatIds.includes(activeSeat.id);
        const isMaint = activeSeat.status === 'maintenance';
        const reservation = allReservations.find(r => r.seat_id === activeSeat.id && r.res_date === selectedDate);

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
                <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/50">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">座位 {activeSeat.label}</h3>
                            <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${statusInfo.color}`}>
                                <StatusIcon className="w-4 h-4" />
                                <span>{statusInfo.label}</span>
                            </div>
                        </div>
                        <button onClick={closeModal} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

                        {/* Admin Reservation */}
                        {!isBooked && !isMaint && activeSeat.seat_type !== 'staff' && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                        <UserPlus className="w-4 h-4 text-indigo-500" />
                                        代為預約
                                    </label>

                                    {/* Reservation Form */}
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500">學號</label>
                                            <input 
                                                type="text" 
                                                value={adminReserveStudentId} 
                                                onChange={e => setAdminReserveStudentId(e.target.value)} 
                                                placeholder="輸入學生學號" 
                                                className="block w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all bg-card text-sm" 
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-medium text-slate-500">日期</label>
                                            <DatePicker value={adminReserveDate} onChange={setAdminReserveDate} />
                                        </div>
                                    </div>

                                    {/* Reservation Button */}
                                    <button 
                                        onClick={handleAdminReserve} 
                                        disabled={!adminReserveStudentId}
                                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm transition-all hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                                    >
                                        <Plus className="w-4 h-4" />
                                        確認預約
                                    </button>
                                </div>  
                                <hr className="border-slate-100" />
                            </>
                        )}

                        {/* Attendance Management */}
                        {isBooked && reservation && (
                            <>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                        <Check className="w-4 h-4 text-blue-500" />
                                        簽到管理
                                    </label>
                                    <div className={`rounded-xl border p-3 ${statusInfo.bg}`}>
                                        <div className="text-sm text-slate-700">
                                            <span className="font-medium">預約學生：</span>
                                            <span className="font-bold">{reservation.student_name || '—'}</span>
                                            <span className="text-slate-400 ml-2">({reservation.student_id})</span>
                                        </div>
                                        {reservation.attendance_status && (
                                            <div className="text-xs text-slate-500 mt-1">
                                                目前簽到狀態：
                                                <span className={`font-bold ml-1 ${reservation.attendance_status === 'present' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {reservation.attendance_status === 'present' ? '✅ 有到' : '❌ 未到'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleUpdateAttendance(reservation.id, 'present')}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-all hover:shadow-md active:scale-95"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            簽到有到
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateAttendance(reservation.id, 'absent')}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-400 transition-all hover:shadow-md active:scale-95"
                                            >
                                            <XCircle className="w-4 h-4" />
                                            簽到未到
                                        </button>
                                    </div>
                                </div>
                                <hr className="border-slate-100" />
                            </>
                        )}

                        {/* Note */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                <Edit3 className="w-4 h-4 text-amber-500" />
                                座位註記
                            </label>
                            <textarea 
                                value={noteText} 
                                onChange={e => setNoteText(e.target.value)} 
                                placeholder="輸入註記（如：靠窗、有插座、冷氣出風口等）" 
                                className="w-full border border-slate-200 rounded-xl p-3 text-sm h-20 outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none bg-card" 
                            />
                            <button 
                                onClick={handleSaveSeatNote} 
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm transition-all hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                            >
                                <Save className="w-4 h-4" />
                                儲存註記
                            </button>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Seat Status Switch */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                                <Wrench className="w-4 h-4 text-slate-500" />
                                座位狀態
                            </label>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleSeatStatus(activeSeat.id, 'maintenance')}
                                    disabled={isMaint}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-yellow-300 text-yellow-700 font-bold text-sm hover:bg-yellow-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                >
                                    <Wrench className="w-4 h-4" />
                                    設為維修中
                                </button>
                                <button 
                                    onClick={() => handleSeatStatus(activeSeat.id, 'available')}
                                    disabled={!isMaint}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-emerald-300 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    恢復可用
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Mobile View */}
            <div className="md:hidden space-y-2">
                {/* Title and Refresh Button */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-amber-600" />
                        座位地圖管理
                    </h2>
                    <RefreshButton onClick={() => { fetchSeats(); fetchAvailability(); }} />
                </div>
                {/* Date Picker and Building Selector */}
                <div className="flex items-center justify-between gap-3">
                    <DatePicker value={selectedDate} onChange={setSelectedDate} />
                    <div className="bg-card-alt p-1 rounded-full shadow-inner border border-slate-200">
                        <button onClick={() => setSelectedBuilding('新館')} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${selectedBuilding === '新館' ? 'bg-card text-accent shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>新館</button>
                        <button onClick={() => setSelectedBuilding('舊館')} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${selectedBuilding === '舊館' ? 'bg-card text-accent shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>舊館</button>
                    </div>
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-amber-600" />
                    座位地圖管理
                </h2>
                <div className="flex items-center gap-2">
                    <DatePicker value={selectedDate} onChange={setSelectedDate} />
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-card-alt p-1 rounded-full shadow-inner border border-slate-200 max-w-max">
                        <button onClick={() => setSelectedBuilding('新館')} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${selectedBuilding === '新館' ? 'bg-card text-accent shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>新館</button>
                        <button onClick={() => setSelectedBuilding('舊館')} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${selectedBuilding === '舊館' ? 'bg-card text-accent shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>舊館</button>
                    </div>
                    <RefreshButton onClick={() => { fetchSeats(); fetchAvailability(); }} />
                </div>
            </div>


            <SeatLegend />

            <div className="bg-gradient-to-br from-slate-100/50 to-indigo-50/50 rounded-2xl border border-slate-200 p-4">
                <SeatMap
                    isAdminView={true}
                    selectedBuilding={selectedBuilding}
                    seats={seats}
                    bookedSeatIds={bookedSeatIds}
                    selectedDate={selectedDate}
                    onSeatClick={handleSeatClick}
                    handleReserve={handleReserve}
                />
            </div>

            {/* 整合式座位管理 Modal */}
            {renderAdminModal()}
        </div>
    );
}
