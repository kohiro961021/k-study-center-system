import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { useApi } from '../../hooks';
import { useSeats, useUI } from '../../context';
import { AttendanceEntry } from '../../type';
import { escapeHtml } from '../../utils';
import { DatePicker, RefreshButton, PrintButton } from '../../components';

export function AttendanceView() {
    const apiCall = useApi();

    const { selectedDate, setSelectedDate } = useSeats();
    const { setView } = useUI();
    
    const [attendanceList, setAttendanceList] = useState<AttendanceEntry[]>([]);

    const fetchAttendanceList = async () => { try { setAttendanceList(await apiCall(`/api/admin/attendance?date=${selectedDate}`)); } catch { } };

    useEffect(() => {
        fetchAttendanceList();
    }, [selectedDate]);

    const handleUpdateAttendance = async (reservationId: number, status: 'present' | 'absent') => {
        try {
            const result = await apiCall(`/api/admin/reservations/${reservationId}/attendance`, 'PUT', { status });
            alert(result.message);
            fetchAttendanceList();
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
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
                            <th>出席狀態</th>
                            <th>簽到時間</th>
                        </tr>
                        </thead>
                        <tbody>
                            ${data.map(d => `
                                <tr>
                                    <td>${escapeHtml(d.seat_label)}</td>
                                    <td>${escapeHtml(d.zone)}</td>
                                    <td>${escapeHtml(d.building)}</td>
                                    <td>${escapeHtml(d.student_id)}</td>
                                    <td>${escapeHtml(d.student_name)}</td>
                                    <td>${escapeHtml(d.attendance_status === 'present' ? '有到' : d.attendance_status === 'absent' ? '未到' : '未點名')}</td>
                                    <td>${escapeHtml(d.check_in_time ? d.check_in_time.split(' ')[1] : '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">🖨️ 列印</button>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (err: any) { alert(`無法取得出席名單: ${err.message}`); }
    };

    return (
        <div className="space-y-6">
            {/* Mobile */}
            <div className="md:hidden space-y-2">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-amber-600" />每日出席狀況
                    </h2>
                    <RefreshButton onClick={fetchAttendanceList} />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <DatePicker value={selectedDate} onChange={setSelectedDate} />
                    <button
                        onClick={() => setView('admin-autoban')}
                        className="flex items-center gap-1 px-2.5 py-2 bg-card hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        title="前往設定缺席規則與重置"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        缺席重置
                    </button>
                    <PrintButton onClick={handlePrintAttendance} />
                </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-amber-600" />每日出席狀況
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('admin-autoban')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        title="前往設定缺席額度門檻與定期重置（自動歸零）規則"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        缺席規則與重置
                    </button>
                    <DatePicker value={selectedDate} onChange={setSelectedDate} />
                    <PrintButton onClick={handlePrintAttendance} />
                    <RefreshButton onClick={fetchAttendanceList} />
                </div>
            </div>


            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card/70 glass-card rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-2xl font-bold text-accent">{attendanceList.length}</div>
                    <div className="text-ms text-slate-500 mt-1">總預約人數</div>
                </div>
                <div className="bg-slate-50/70 backdrop-blur rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-500">{attendanceList.filter(a => !a.attendance_status).length}</div>
                    <div className="text-ms text-slate-500 mt-1">未點名</div>
                </div>
                <div className="bg-emerald-50/70 backdrop-blur rounded-xl border border-emerald-200 p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{attendanceList.filter(a => a.attendance_status === 'present').length}</div>
                    <div className="text-ms text-emerald-600 mt-1">有到</div>
                </div>
                <div className="bg-red-50/70 backdrop-blur rounded-xl border border-red-200 p-4 text-center">
                    <div className="text-2xl font-bold text-red-500">{attendanceList.filter(a => a.attendance_status === 'absent').length}</div>
                    <div className="text-ms text-red-500 mt-1">未到</div>
                </div>
            </div>

            {/* Attendance table */}
            {attendanceList.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">該日期沒有任何預約</div>
            ) : (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">

                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">座位</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">區域</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">館別</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-700">出席狀態</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">簽到時間</th>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">操作</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {attendanceList.map(entry => (
                                <tr key={entry.id} className={`transition ${entry.attendance_status === 'present' ? 'bg-emerald-50/30' : entry.attendance_status === 'absent' ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                    <td className="px-4 py-3 font-bold">{entry.seat_label}</td>
                                    <td className="px-4 py-3 text-slate-600">{entry.zone}</td>
                                    <td className="px-4 py-3 text-slate-600">{entry.building}</td>
                                    <td className="px-4 py-3 text-accent font-medium">{entry.student_id}</td>
                                    <td className="px-4 py-3 text-slate-600">{entry.student_name}</td>
                                    <td className="px-4 py-3 text-center">
                                        {entry.attendance_status === 'present' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" />有到</span>}
                                        {entry.attendance_status === 'absent' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold"><XCircle className="w-3.5 h-3.5" />未到</span>}
                                        {!entry.attendance_status && <span className="text-slate-400 text-xs">未點名</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                        {entry.check_in_time ? entry.check_in_time.split(' ')[1] : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleUpdateAttendance(entry.id, 'present')} className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${entry.attendance_status === 'present' ? 'bg-emerald-500 text-white' : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'}`}><CheckCircle className="w-3 h-3" />有到</button>
                                            <button onClick={() => handleUpdateAttendance(entry.id, 'absent')} className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${entry.attendance_status === 'absent' ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50 border border-red-200'}`}><XCircle className="w-3 h-3" />未到</button>
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
