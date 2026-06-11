import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useSeats } from '../../context';
import { useApi } from '../../hooks';
import { Reservation } from '../../type';

export function MyReserveView() {
    const apiCall = useApi();
    const { seats, setSeats } = useSeats();
    const [myReservations, setMyReservations] = useState<Reservation[]>([]);

    const fetchSeats = async () => { try { setSeats(await apiCall('/api/seats')); } catch { } };
    const fetchMyReservations = async () => { try { setMyReservations(await apiCall('/api/my-reservations')); } catch { } };

    useEffect(() => {
        fetchMyReservations();
        fetchSeats();
    }, []);

    const handleCancel = async (resId: number) => {
        if (!window.confirm('確定要取消這個預約嗎？')) return;
        try { 
            await apiCall(`/api/reservations/${resId}`, 'DELETE'); 
            fetchMyReservations(); 
            fetchSeats();
        } catch (err: any) { 
            alert(`無法取消：${err.message}`); 
        }
    };

    const todayStr = new Date().toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');

    const sortedReservations = [...myReservations].sort((a, b) => {
        return new Date(a.res_date).getTime() - new Date(b.res_date).getTime();
    });

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">我的預約紀錄</h2>
            {sortedReservations.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">
                    目前沒有預約，快去搶位子吧！
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sortedReservations.map(res => {
                        const seat = seats.find(s => s.id === res.seat_id);
                        // 判斷是否為今天
                        const isToday = res.res_date === "2026-06-11";

                        return (
                            <div 
                                key={res.id} 
                                className={`bg-card/70 glass-card p-5 rounded-xl border-2 shadow-sm flex justify-between items-start transition-all ${
                                    isToday ? 'border-accent ring-1 ring-accent/30' : 'border-slate-200'
                                }`}
                            >
                                <div>
                                    <div className="text-lg font-bold text-accent mb-1">
                                        座位 {seat?.label || `#${res.seat_id}`}
                                    </div>
                                    {seat && (
                                        /* 修正 text-ms 錯字為 text-sm */
                                        <div className="text-sm text-slate-500 mb-2">
                                            {seat.building} · {seat.zone}
                                        </div>
                                    )}
                                    <div className="text-sm text-slate-600 flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {res.res_date}
                                        {isToday && (
                                            <span className="ml-1 text-xs text-accent font-semibold bg-accent/10 px-1.5 py-0.5 rounded">
                                                今天
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleCancel(res.id)} 
                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg border border-transparent hover:border-red-200 text-sm font-bold transition flex-shrink-0"
                                >
                                    取消
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}