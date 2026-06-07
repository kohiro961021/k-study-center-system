import { useState, useEffect } from 'react';
import { useSeats } from '../../context';
import { useApi } from '../../hooks';
import { SeatLegend, SeatMap, RefreshButton } from '../../components';

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

    // Generate date options for the next 13 days
    const dateOptions = Array.from({ length: 13 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayOfWeek = dayNames[d.getDay()];
        const monthDay = `${d.getMonth() + 1}/${d.getDate()}`;
        
        return {
            dateStr,
            monthDay,
            dayOfWeek,
            isToday: i === 0
        };
    });

    return (
        <div className="space-y-4">
            {/* Control Panel (Date Cards Carousel & Zone Selector) */}
            <div className="bg-card/70 glass-card p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <label className="text-lg font-bold text-slate-700">選擇日期與館別</label>

                    <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                        {/* Zone Selector (Capsule Switch) */}
                        <div className=" bg-card-alt p-1 rounded-full shadow-inner border border-slate-200">
                            <button onClick={() => setSelectedBuilding('新館')} disabled={isWeekend(selectedDate)} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${isWeekend(selectedDate) ? 'text-slate-400 cursor-not-allowed' : selectedBuilding === '新館' ? 'bg-card text-accent shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{isWeekend(selectedDate) ? '新館(週末關閉)' : '新館'}</button>
                            <button onClick={() => setSelectedBuilding('舊館')} className={`px-5 py-1.5 rounded-full font-bold text-sm transition-all duration-300 ${selectedBuilding === '舊館' || isWeekend(selectedDate) ? 'bg-card text-accent shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>舊館</button>
                        </div>

                        {/* Refresh Button */}
                        <RefreshButton onClick={() => { fetchSeats(); fetchAvailability(); }} />
                    </div>
                </div>
                
                {/* Date Cards Carousel */}
                <div className="md:ml-6 flex gap-3 overflow-x-auto p-2 scrollbar-thin scroll-smooth snap-x snap-mandatory">

                    {dateOptions.map((opt) => {
                        const isSelected = selectedDate === opt.dateStr;
                        return (
                            <button
                                key={opt.dateStr}
                                onClick={() => setSelectedDate(opt.dateStr)}
                                className={`flex flex-col items-center justify-center min-w-[76px] py-3 rounded-xl border transition-all duration-300 cursor-pointer snap-start
                                    ${isSelected 
                                        ? 'bg-accent-soft text-accent border-accent shadow-sm scale-105 font-bold' 
                                        : 'bg-card text-slate-700 border-slate-200 hover:border-accent/50 hover:scale-105 hover:shadow-sm'
                                    }`}
                            >

                                <span className={`text-xs transition-colors ${isSelected ? 'text-accent/80' : 'text-slate-400'}`}>
                                    {opt.isToday ? '今天' : `週${opt.dayOfWeek}`}
                                </span>

                                <span className="text-base font-bold mt-1">
                                    {opt.monthDay}
                                </span>

                            </button>
                        );
                    })}

                </div>
            </div>

            <div className="bg-gradient-to-br from-slate-100/50 to-indigo-50/50 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
                    {isWeekend(selectedDate) && selectedBuilding === '新館' ? '舊館' : selectedBuilding}座位圖 — 點擊空位即可預約
                </h3>
                <SeatLegend />
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
