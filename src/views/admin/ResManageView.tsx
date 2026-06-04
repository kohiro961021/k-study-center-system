import { useState, useEffect } from 'react';
import { Calendar, Printer, RefreshCw, Search, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks';
import { useUI, useSeats } from '../../context';
import { escapeHtml } from '../../utils';
import { AdminReservation, SortKey, SortDir, AttendanceEntry } from '../../type';

export function ResManageView() {
    const apiCall = useApi();
    const { setAdminMessage } = useUI();
    const { selectedDate, setSelectedDate } = useSeats();
    
    const [allReservations, setAllReservations] = useState<AdminReservation[]>([]);
    const [reservationSearch, setReservationSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('res_date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const fetchAdminReservations = async () => { try { setAllReservations(await apiCall('/api/admin/reservations')); } catch { } };

    useEffect(() => {
        fetchAdminReservations();
    }, [selectedDate]);

    const handleAdminCancelReservation = async (resId: number) => {
        if (!window.confirm('確定要取消這個學生的預約嗎？')) return;
        try { 
            await apiCall(`/api/admin/reservations/${resId}`, 'DELETE'); 
            setAdminMessage('已成功取消預約'); 
            fetchAdminReservations();
        } catch (err: any) { 
            setAdminMessage(`取消失敗: ${err.message}`); 
        }
    };

    const handleUpdateAttendance = async (reservationId: number, status: 'present' | 'absent') => {
        try {
            const result = await apiCall(`/api/admin/reservations/${reservationId}/attendance`, 'PUT', { status });
            setAdminMessage(result.message);
            fetchAdminReservations();
        } catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
    };

    const handlePrintAttendance = async () => {
        try {
            const data: AttendanceEntry[] = await apiCall(`/api/admin/attendance?date=${selectedDate}`);
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>出席名單 ${selectedDate}</title>
                    <style>
                        body{font-family:'Microsoft JhengHei',sans-serif;padding:20px}
                        h1{text-align:center;font-size:20px;margin-bottom:4px}
                        h2{text-align:center;font-size:14px;color:#666;margin-bottom:16px}
                        table{width:100%;border-collapse:collapse}
                        th,td{border:1px solid #333;padding:6px 10px;text-align:center;font-size:13px}
                        th{background:#f0f0f0;font-weight:bold}
                        @media print{button{display:none}}
                    </style>
                </head>
                <body>
                    <h1>鳳山高中 K書中心 出席名單</h1>
                    <h2>日期：${selectedDate}　　共 ${data.length} 人</h2>
                    <table>
                        <thead>
                        <tr>
                            <th>座位號碼</th>
                            <th>區域</th>
                            <th>館別</th>
                            <th>學號</th>
                            <th>姓名</th>
                        </tr>
                        </thead>

                        <tbody>
                            ${data.map(d => `
                                <tr><td>${escapeHtml(d.seat_label)}</td>
                                <td>${escapeHtml(d.zone)}</td>
                                <td>${escapeHtml(d.building)}</td>
                                <td>${escapeHtml(d.student_id)}</td>
                                <td>${escapeHtml(d.student_name)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <button 
                        onclick="window.print()" 
                        style="padding:8px 24px;font-size:14px;cursor:pointer"
                    >
                        🖨️ 列印
                    </button>
                </body>
                </html>
            `);
            
            printWindow.document.close();

        } catch (err: any) { setAdminMessage(`無法取得出席名單: ${err.message}`); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-6 h-6 text-amber-600" />全部預約紀錄</h2>
                <div className="flex items-center gap-2">
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                    <button onClick={handlePrintAttendance} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><Printer className="w-4 h-4" />列印出席名單</button>
                    <button onClick={fetchAdminReservations} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 bg-card/80 glass-card border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                    type="text"
                    value={reservationSearch}
                    onChange={e => setReservationSearch(e.target.value)}
                    placeholder="搜尋學號、姓名、座位、日期..."
                    className="flex-1 outline-none text-sm bg-transparent placeholder-slate-400"
                />
                {reservationSearch && (
                    <button onClick={() => setReservationSearch('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
                )}
            </div>

            {allReservations.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">目前沒有任何預約紀錄</div>
            ) : (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer select-none" onClick={() => { if (sortKey === 'student_id') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('student_id'); setSortDir('asc'); } }}>學號 {sortKey === 'student_id' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer select-none" onClick={() => { if (sortKey === 'seat_label') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('seat_label'); setSortDir('asc'); } }}>座位 {sortKey === 'seat_label' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer select-none" onClick={() => { if (sortKey === 'res_date') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('res_date'); setSortDir('desc'); } }}>日期 {sortKey === 'res_date' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700">出席</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer select-none" onClick={() => { if (sortKey === 'created_at') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('created_at'); setSortDir('desc'); } }}>建立時間 {sortKey === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer select-none" onClick={() => { if (sortKey === 'updated_at') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey('updated_at'); setSortDir('desc'); } }}>最後修改 {sortKey === 'updated_at' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                            </tr>
                        </thead>
    
                        <tbody className="divide-y divide-slate-100">
                            {[...allReservations].filter(res => {
                                if (!reservationSearch.trim()) return true;
                                const q = reservationSearch.trim().toLowerCase();
                                return (
                                    res.student_id.toLowerCase().includes(q) ||
                                    res.student_name.toLowerCase().includes(q) ||
                                    res.seat_label.toLowerCase().includes(q) ||
                                    res.res_date.includes(q)
                                );
                            }).sort((a, b) => { 
                                const av = (a as any)[sortKey] || ''; 
                                const bv = (b as any)[sortKey] || '';
                                return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av)); 
                            }).map(res => (
                                <tr key={res.id} className="hover:bg-slate-50 transition">
                                    <td className="px-4 py-3 text-accent font-medium">{res.student_id}</td>
                                    <td className="px-4 py-3 text-slate-600">{res.student_name}</td>
                                    <td className="px-4 py-3 font-bold">{res.seat_label}</td>
                                    <td className="px-4 py-3 text-slate-600">{res.res_date}</td>
                                    <td className="px-4 py-3 text-center">
                                        {res.attendance_status === 'present' && <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs"><CheckCircle className="w-3.5 h-3.5" />有到</span>}
                                        {res.attendance_status === 'absent' && <span className="inline-flex items-center gap-1 text-red-500 font-bold text-xs"><XCircle className="w-3.5 h-3.5" />未到</span>}
                                        {!res.attendance_status && <span className="text-slate-400 text-xs">未點名</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{res.created_at || '-'}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{res.updated_at || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button onClick={() => handleUpdateAttendance(res.id, 'present')} className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 text-xs font-bold transition" title="有到"><CheckCircle className="w-3 h-3" /></button>
                                            <button onClick={() => handleUpdateAttendance(res.id, 'absent')} className="text-orange-500 hover:bg-orange-50 px-2 py-1 rounded-lg border border-orange-200 text-xs font-bold transition" title="未到"><XCircle className="w-3 h-3" /></button>
                                            <button onClick={() => handleAdminCancelReservation(res.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 text-xs font-bold transition" title="取消預約"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
