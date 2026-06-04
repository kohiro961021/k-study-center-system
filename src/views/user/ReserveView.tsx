import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSeats } from '../../context';
import { useApi } from '../../hooks';
import { SeatLegend, SeatMap } from '../../components';

function isWeekend(dateStr: string): boolean {
	const d = new Date(dateStr + 'T00:00:00');
	return d.getDay() === 0 || d.getDay() === 6;
}

export function ReserveView() {
    const apiCall = useApi();
    const { 
        selectedDate, setSelectedDate,
        selectedBuilding, setSelectedBuilding,
        seats, setSeats,
        bookedSeatIds, setBookedSeatIds
    } = useSeats();

    const fetchSeats = async () => { try { setSeats(await apiCall('/api/seats')); } catch { } };
    const fetchAvailability = async () => { try { setBookedSeatIds(await apiCall(`/api/availability?res_date=${selectedDate}`)); } catch { } };

    useEffect(() => {
        fetchSeats();
        fetchAvailability();
    }, [selectedDate]);

    const handleReserve = async (seatId: number) => {
        if (!window.confirm('確定要預約這個座位嗎？')) return;
        try { 
            await apiCall('/api/reserve', 'POST', { seat_id: seatId, res_date: selectedDate }); 
            alert('預約成功！'); 
            fetchAvailability(); 
        } catch (err: any) { 
            alert(`預約失敗: ${err.message}`); 
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-card/70 glass-card p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
                <div className="space-y-1 flex-1 min-w-[180px]">
                    <label className="text-sm font-bold text-slate-700">選擇日期</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="block w-full px-3 py-2 bg-input border border-slate-200 rounded-lg outline-none" />
                    {isWeekend(selectedDate) && <div className="text-xs text-amber-600 font-medium mt-1">⚠️ 週六日僅開放舊館</div>}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setSelectedBuilding('新館')} disabled={isWeekend(selectedDate)} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isWeekend(selectedDate) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : selectedBuilding === '新館' ? 'bg-accent text-[#fff]' : 'bg-card border border-slate-200'}`}>{isWeekend(selectedDate) ? '新館（週末未開放）' : '新館'}</button>
                    <button onClick={() => setSelectedBuilding('舊館')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${selectedBuilding === '舊館' || isWeekend(selectedDate) ? 'bg-accent text-[#fff]' : 'bg-card border border-slate-200'}`}>舊館</button>
                </div>

                <button onClick={() => { fetchSeats(); fetchAvailability(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
            </div>

            <SeatLegend />

            <div className="bg-gradient-to-br from-slate-100/50 to-indigo-50/50 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">
                    📍 {isWeekend(selectedDate) && selectedBuilding === '新館' ? '舊館' : selectedBuilding}座位圖 — 點擊空位即可預約
                </h3>

                <SeatMap
                    isAdminView={false}
                    selectedBuilding={isWeekend(selectedDate) && selectedBuilding === '新館' ? '舊館' : selectedBuilding}
                    seats={seats}
                    bookedSeatIds={bookedSeatIds}
                    selectedDate={selectedDate}
                    handleReserve={handleReserve}
                />
            </div>
        </div>
    );
}
