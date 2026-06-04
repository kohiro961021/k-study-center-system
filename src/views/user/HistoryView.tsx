import { useState, useEffect } from 'react';
import { History, CheckCircle, XCircle } from 'lucide-react';
import { useApi } from '../../hooks';
import { HistoryReservation } from '../../type';

export function HistoryView() {
    const apiCall = useApi();
    const [myHistory, setMyHistory] = useState<HistoryReservation[]>([]);

    const fetchMyHistory = async () => { try { setMyHistory(await apiCall('/api/my-history')); } catch { } };

    useEffect(() => {
        fetchMyHistory();
    }, []);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><History className="w-6 h-6 text-indigo-600" />歷史預約紀錄</h2>
            <p className="text-sm text-slate-500">以下為過去日期或當天已點名的預約，無法取消。</p>

            {myHistory.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">目前沒有歷史紀錄</div>
            ) : (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">日期</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">座位</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">館別</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">區域</th>
                            <th className="px-4 py-3 text-center font-bold text-slate-700">出席狀態</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {myHistory.map(h => (
                            <tr key={h.id} className={`transition ${h.attendance_status === 'present' ? 'bg-emerald-50/30' : h.attendance_status === 'absent' ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3 text-slate-600">{h.res_date}</td>
                                <td className="px-4 py-3 font-bold text-accent">{h.seat_label}</td>
                                <td className="px-4 py-3 text-slate-600">{h.seat_building}</td>
                                <td className="px-4 py-3 text-slate-600">{h.seat_zone}</td>
                                <td className="px-4 py-3 text-center">

                                {h.attendance_status === 'present' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" />有到</span>}
                                {h.attendance_status === 'absent' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold"><XCircle className="w-3.5 h-3.5" />未到</span>}
                                {!h.attendance_status && <span className="text-slate-400 text-xs">未點名</span>}
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
