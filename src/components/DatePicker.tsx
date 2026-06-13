import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Track the month currently displayed in the calendar dropdown
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = value ? new Date(value) : new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const containerRef = useRef<HTMLDivElement>(null);

    // Keep currentMonth in sync when value changes externally or when picker opens/closes
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    }, [isOpen, value]);

    // Click outside listener to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Generate days in the calendar grid
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sunday) to 6 (Saturday)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous month total days to fill starting padding
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; dateStr: string }[] = [];

    // Padding from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, prevMonthDays - i);
        cells.push({
            date: d,
            dateStr: formatDate(d),
        });
    }

    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        cells.push({
            date: d,
            dateStr: formatDate(d),
        });
    }

    // Padding from next month to make grid a multiple of 7 (usually 42 cells total)
    const totalCells = 42;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        cells.push({
            date: d,
            dateStr: formatDate(d),
        });
    }

    function formatDate(d: Date): string {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    const handleSelectDay = (dateStr: string) => {
        onChange(dateStr);
        setIsOpen(false);
    };

    // Formatted display date e.g., 2026/06/06
    const displayValue = value ? value.replace(/-/g, '/') : '';

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-base bg-card hover:bg-slate-50 dark:hover:bg-slate-200/50 cursor-pointer transition text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/50 select-none font-medium w-full md:w-auto justify-between md:justify-start"
            >
                <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <span>{displayValue}</span>
                </span>
            </button>

            {/* Calendar Popover */}
            {isOpen && (
                <>
                    {/* Background Overlay for Mobile */}
                    <div
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Calendar Body: Mobile fixed center, Desktop absolute dropdown */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0 md:block md:absolute md:inset-auto md:left-0 md:mt-2 pointer-events-none">
                        <div className="w-80 bg-card/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-5 select-none animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-200/50 transition"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <h4 className="text-base font-bold text-slate-800">
                                    {year} 年 {month + 1} 月
                                </h4>
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-200/50 transition"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Weekday Names */}
                            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                                    <span key={day} className="text-xs font-semibold text-slate-400 py-1">
                                        {day}
                                    </span>
                                ))}
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {cells.map((cell, idx) => {
                                    const isSelected = cell.dateStr === value;
                                    const isTodayStr = formatDate(new Date()) === cell.dateStr;
                                    const isOtherMonth = cell.date.getMonth() !== month;

                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleSelectDay(cell.dateStr)}
                                            className={`h-9 w-9 text-sm rounded-xl transition-all flex items-center justify-center font-medium
                                                ${isSelected
                                                    ? 'bg-accent text-white font-bold shadow-sm shadow-accent/20'
                                                    : isTodayStr
                                                        ? 'border border-accent/60 text-accent hover:bg-accent-soft'
                                                        : isOtherMonth
                                                            ? 'text-slate-300 hover:bg-slate-50'
                                                            : 'text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-200/50'
                                                }`}
                                        >
                                            {cell.date.getDate()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
