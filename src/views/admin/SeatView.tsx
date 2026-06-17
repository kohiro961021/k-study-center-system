import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit3 } from 'lucide-react';
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
    
    const [editingSeatNote, setEditingSeatNote] = useState<SeatData | null>(null);
    const [noteText, setNoteText] = useState('');

    const [showAdminReserve, setShowAdminReserve] = useState(false);
    const [adminReserveSeatId, setAdminReserveSeatId] = useState<number | null>(null);
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

    const handleUpdateAttendance = async (reservationId: number, status: 'present' | 'absent') => {
        try {
            const result = await apiCall(`/api/admin/reservations/${reservationId}/attendance`, 'PUT', { status });
            alert(result.message);
            fetchAdminReservations();
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
    };

    const handleSeatStatus = async (seatId: number, newStatus: 'maintenance' | 'available') => {
        const action = newStatus === 'maintenance' ? '設為維修中（會自動取消該座位未來的所有預約）' : '恢復為可用';
        if (!window.confirm(`確定要${action}嗎？`)) return;
        try {
            const result = await apiCall(`/api/admin/seats/${seatId}/status`, 'PUT', { status: newStatus });
            alert(result.message);
            fetchSeats();
            fetchAvailability();
            fetchAdminReservations();
        } catch (err: any) { alert(`操作失敗: ${err.message}`); }
    };

    const handleReserve = async (seatId: number) => {
        if (!window.confirm('確定要預約這個座位嗎？')) return;
        try { 
            await apiCall('/api/reserve', 'POST', { seat_id: seatId, res_date: selectedDate }); 
            alert('預約成功！'); 
            fetchAvailability(); 
            fetchAdminReservations(); 
        } catch (err: any) { alert(`預約失敗: ${err.message}`); }
    };

    const handleSaveSeatNote = async () => {
        if (!editingSeatNote) return;
        try { 
            await apiCall(`/api/admin/seats/${editingSeatNote.id}/note`, 'PUT', { note: noteText });
            setEditingSeatNote(null); 
            fetchSeats(); 
            alert('註記已更新'); 
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
    };

    const handleAdminReserve = async () => {
        if (!adminReserveSeatId || !adminReserveStudentId) return;
        try { 
            const result = await apiCall('/api/admin/reserve', 'POST', { student_id: adminReserveStudentId, seat_id: adminReserveSeatId, res_date: adminReserveDate }); 
            alert(result.message);
            setShowAdminReserve(false);
            fetchAvailability();
            fetchAdminReservations();
        } catch (err: any) { alert(`預約失敗: ${err.message}`); }
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
                    allReservations={allReservations}
                    setEditingSeatNote={setEditingSeatNote}
                    setNoteText={setNoteText}
                    setAdminReserveSeatId={setAdminReserveSeatId}
                    setAdminReserveStudentId={setAdminReserveStudentId}
                    setAdminReserveDate={setAdminReserveDate}
                    setShowAdminReserve={setShowAdminReserve}
                    handleUpdateAttendance={handleUpdateAttendance}
                    handleSeatStatus={handleSeatStatus}
                    handleReserve={handleReserve}
                />
            </div>

            {editingSeatNote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit3 className="w-5 h-5 text-amber-600" />編輯座位 {editingSeatNote.label} 註記</h3>
                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="輸入註記（如：靠窗、有插座、冷氣出風口等）" className="w-full border border-slate-200 rounded-lg p-3 text-sm h-24 outline-none focus:ring-2 focus:ring-amber-400" />
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setEditingSeatNote(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm">取消</button>
                            <button onClick={handleSaveSeatNote} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 transition">儲存</button>
                        </div>
                    </div>
                </div>
            )}

            {showAdminReserve && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" />代為預約座位 {(adminReserveSeatId && seats.find(s => s.id === adminReserveSeatId)?.label) || ''}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-slate-600">學號</label>
                                <input type="text" value={adminReserveStudentId} onChange={e => setAdminReserveStudentId(e.target.value)} placeholder="輸入學生學號" className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-slate-600">日期</label>
                                <DatePicker value={adminReserveDate} onChange={setAdminReserveDate} />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setShowAdminReserve(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm">取消</button>
                            <button onClick={handleAdminReserve} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition">確認預約</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
