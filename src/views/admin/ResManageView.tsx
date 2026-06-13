import { useState, useEffect } from 'react';
import { Calendar, Search, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks';
import { useUI } from '../../context';
import { escapeHtml } from '../../utils';
import { RefreshButton, PrintButton } from '../../components';
import { AdminReservation, SortKey, SortDir } from '../../type';

export function ResManageView() {
    const apiCall = useApi();
    const { setAdminMessage } = useUI();
    
    const [allReservations, setAllReservations] = useState<AdminReservation[]>([]);
    const [reservationSearch, setReservationSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('res_date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    
    // Pagination states
    const [page, setPage] = useState(1);
    const [size] = useState(20);
    const [total, setTotal] = useState(0);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(reservationSearch);
            setPage(1); // Reset to page 1 on new search
        }, 300);
        return () => clearTimeout(timer);
    }, [reservationSearch]);

    const fetchAdminReservations = async () => { 
        try { 
            const query = `page=${page}&size=${size}&search=${encodeURIComponent(debouncedSearch)}&sort_by=${sortKey}&sort_dir=${sortDir}`;
            const data = await apiCall(`/api/admin/reservations?${query}`); 
            setAllReservations(data.items);
            setTotal(data.total);
        } catch { } 
    };

    useEffect(() => {
        fetchAdminReservations();
    }, [page, debouncedSearch, sortKey, sortDir]);

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
            setAdminMessage('正在載入待列印資料...');
            const query = `search=${encodeURIComponent(debouncedSearch)}&sort_by=${sortKey}&sort_dir=${sortDir}&all=true`;
            const printItems = await apiCall(`/api/admin/reservations?${query}`);

            if (!printItems || printItems.length === 0) {
                setAdminMessage('目前沒有符合篩選條件的資料可供列印');
                return;
            }

            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const searchKeyword = reservationSearch.trim();
            const subTitleLabel = searchKeyword ? `篩選條件："${searchKeyword}"` : '全部預約名單';

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>預約名單列印</title>
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
                        <button 
                            onclick="window.print()" 
                            style="padding:8px 24px;font-size:14px;cursor:pointer;background:#475569;color:#fff;border:none;border-radius:6px; position:fixed;top:20px;right:20px;box-shadow:0 2px 6px rgba(0,0,0,0.2);"
                        >
                            🖨️ 確認列印
                        </button>
                        <h1>鳳山高中 K書中心 預約名單</h1>
                        <h2>${subTitleLabel}  共 ${printItems.length} 筆</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>預約日期</th>
                                    <th>座位號碼</th>
                                    <th>學號</th>
                                    <th>姓名</th>
                                    <th>出席狀態</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${printItems.map((d: any) => `
                                    <tr>
                                        <td>${escapeHtml(d.res_date)}</td>
                                        <td>${escapeHtml(d.seat_label)}</td>
                                        <td>${escapeHtml(d.student_id)}</td>
                                        <td>${escapeHtml(d.student_name)}</td>
                                        <td>${d.attendance_status === 'present' ? '有到' : d.attendance_status === 'absent' ? '未到' : '未點名'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </body>
                </html>
            `);
            
            printWindow.document.close();
            setAdminMessage('待列印資料載入完成');
        } catch (err: any) {
            setAdminMessage(`載入列印資料失敗: ${err.message}`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header & Refresh Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-6 h-6 text-amber-600" />全部預約紀錄</h2>
                <RefreshButton onClick={fetchAdminReservations} />
            </div>

            {/* Search Bar & Print Button */}
            <div className="flex items-center gap-4 justify-between">
                {/* Search bar */}
                <div className="flex w-full items-center gap-2 bg-card/80 glass-card border border-slate-200 rounded-full px-4 py-3 shadow-sm">
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

                <PrintButton onClick={handlePrintAttendance} />
            </div>

            {/* Data Render */}
            {allReservations.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">目前沒有任何預約紀錄</div>
            ) : (
                <>
                    {/* Mobile View List */}
                    <div className="md:hidden space-y-3">
                        {allReservations.map(res => (
                            <div
                                key={res.id}
                                className={`bg-card/70 glass-card p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 transition-all duration-200 ${
                                    res.attendance_status === 'present' ? 'border-l-4 border-l-emerald-500' :
                                    res.attendance_status === 'absent' ? 'border-l-4 border-l-red-500' : ''
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-sm font-bold text-slate-800">{res.student_name}</span>
                                        <span className="ml-2 text-xs text-accent font-medium">{res.student_id}</span>
                                    </div>
                                    <span className="text-xs text-slate-500">{res.res_date}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-700">座位 <span className="text-accent">{res.seat_label}</span></span>
                                    <div>
                                        {res.attendance_status === 'present' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold"><CheckCircle className="w-3 h-3" />有到</span>}
                                        {res.attendance_status === 'absent' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold"><XCircle className="w-3 h-3" />未到</span>}
                                        {!res.attendance_status && <span className="text-slate-400 text-xs font-medium">未點名</span>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                    <button onClick={() => handleUpdateAttendance(res.id, 'present')} className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${res.attendance_status === 'present' ? 'bg-emerald-500 text-white' : 'text-emerald-600 border border-emerald-200 hover:bg-emerald-50'}`}>
                                        <CheckCircle className="w-3.5 h-3.5" />有到
                                    </button>
                                    <button onClick={() => handleUpdateAttendance(res.id, 'absent')} className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${res.attendance_status === 'absent' ? 'bg-red-500 text-white' : 'text-red-500 border border-red-200 hover:bg-red-50'}`}>
                                        <XCircle className="w-3.5 h-3.5" />未到
                                    </button>
                                    <button onClick={() => handleAdminCancelReservation(res.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition flex items-center gap-1">
                                        <Trash2 className="w-3.5 h-3.5" />取消
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop View Table */}
                    <div className="hidden md:block bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
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
                                {allReservations.map(res => (
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

                    {/* Pagination Controls */}
                    {total > size && (
                        <div className="flex items-center justify-between px-4 py-3 bg-card/70 glass-card border border-slate-200 rounded-2xl shadow-sm mt-4">
                            <div className="text-sm text-slate-500">
                                顯示第 <span className="font-medium">{(page - 1) * size + 1}</span> 至 <span className="font-medium">{Math.min(page * size, total)}</span> 筆，共 <span className="font-medium">{total}</span> 筆紀錄
                            </div>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition active:scale-95"
                                >
                                    上一頁
                                </button>
                                <div className="flex items-center px-3 text-sm text-slate-700 font-bold">
                                    頁次 {page} / {Math.ceil(total / size)}
                                </div>
                                <button
                                    disabled={page >= Math.ceil(total / size)}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition active:scale-95"
                                >
                                    下一頁
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}