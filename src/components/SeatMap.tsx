import React, { useRef, useEffect } from 'react';
import { SeatData, AdminReservation } from '../type';
import { NEW_BUILDING_ZONES, OLD_BUILDING_ZONES, OLD_STAFF_ZONES } from '../constants/seats';

interface BaseSeatMapProps {
	selectedBuilding: '新館' | '舊館';
	seats: SeatData[];
	bookedSeatIds: number[];
	selectedDate: string;
	handleReserve: (seatId: number) => void;
}

interface StudentSeatMapProps extends BaseSeatMapProps {
	isAdminView: false;
}

interface AdminSeatMapProps extends BaseSeatMapProps {
	isAdminView: true;
	allReservations: AdminReservation[];
	setEditingSeatNote: (seat: SeatData | null) => void;
	setNoteText: (text: string) => void;
	setAdminReserveSeatId: (id: number | null) => void;
	setAdminReserveStudentId: (id: string) => void;
	setAdminReserveDate: (date: string) => void;
	setShowAdminReserve: (show: boolean) => void;
	handleUpdateAttendance: (id: number, status: 'present' | 'absent') => void;
	handleSeatStatus: (seatId: number, status: 'maintenance' | 'available') => void;
}

type SeatMapProps = StudentSeatMapProps | AdminSeatMapProps;

export const SeatLegend = () => (
  <div className="flex gap-3 text-xs mb-4 justify-center">
    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 border-2 border-emerald-400 inline-block" /> 空位</span>
    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-100 border-2 border-red-300 inline-block" /> 已預約</span>
    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100 border-2 border-amber-400 inline-block" /> 工讀生</span>
    <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-400 inline-block" /> 維修中</span>
    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 有註記</span>
    <span className="flex items-center gap-1">
		<span className="text-gray-500 font-medium border-b border-gray-400">柱</span>
		<span className="text-gray-600">：代表旁邊有柱子</span>
    </span>
  </div>
);

export const SeatMap = (props: SeatMapProps) => {
	const {
		isAdminView,
		selectedBuilding,
		seats,
		bookedSeatIds,
		selectedDate,
		handleReserve
	} = props;

	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		
		const handleWheel = (e: WheelEvent) => {
			if (e.deltaY !== 0 && !e.shiftKey) {
				const maxScrollLeft = el.scrollWidth - el.clientWidth;
				// 只有當容器可水平滾動時，才攔截垂直滾動並轉為水平滾動
				if (maxScrollLeft > 0) {
					e.preventDefault();
					el.scrollLeft += e.deltaY;
				}
			}
		};
		
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	}, [selectedBuilding]);

	const seatMap = new Map<number, SeatData>(seats.map(s => [s.seat_number, s]));

	const renderSeatButton = (seatNum: number) => {
		const seat = seatMap.get(seatNum);
		if (!seat) return <div key={seatNum} className="w-10 h-10 rounded bg-slate-100 opacity-30" />;

		const isBooked = bookedSeatIds.includes(seat.id);
		const isPillar = seat.seat_type === 'pillar';
		const isReservablePillar = isPillar && [72, 64, 83, 77].includes(seat.seat_number);
		const isStaff = seat.seat_type === 'staff';
		const isMaint = seat.status === 'maintenance';
		const disabled = isBooked || (isPillar && !isReservablePillar) || isStaff || isMaint;

		let bg = 'bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:-translate-y-0.5';
		if (isPillar && !isReservablePillar) bg = 'bg-slate-300 border-slate-400 text-slate-500 cursor-not-allowed';
		else if (isStaff) bg = 'bg-amber-100 border-amber-400 text-amber-700 cursor-not-allowed';
		else if (isMaint) bg = 'bg-yellow-100 border-yellow-400 text-yellow-700 cursor-not-allowed';
		else if (isBooked) bg = 'bg-red-100 border-red-300 text-red-500 cursor-not-allowed';

		const handleClick = () => {
			if (props.isAdminView) {
				const {
					setEditingSeatNote, setNoteText, setAdminReserveSeatId,
					setAdminReserveStudentId, setAdminReserveDate, setShowAdminReserve,
					allReservations, handleUpdateAttendance, handleSeatStatus
				} = props;

				if (isPillar && !isReservablePillar) return;

				const statusText = isMaint ? '維修中' : isBooked ? '已預約' : isStaff ? '工讀生' : '空位';
				const action = window.prompt(`座位 ${seat.label}\n${seat.note ? `註記: ${seat.note}\n` : ''}狀態: ${statusText}\n\n輸入操作：\n1 = 編輯註記\n2 = 代為預約\n3 = 有到\n4 = 未到\n5 = 設為維修中\n6 = 恢復可用\n取消 = 關閉`);

				switch (action) {
					case '1':
						setEditingSeatNote(seat);
						setNoteText(seat.note || '');
						break;
					case '2':
						setAdminReserveSeatId(seat.id);
						setAdminReserveStudentId('');
						setAdminReserveDate(selectedDate);
						setShowAdminReserve(true);
						break;
					case '3':
					case '4':
						const targetRes = allReservations.find(r => r.seat_id === seat.id && r.res_date === selectedDate);

						if (!targetRes) { alert('該座位在這個日期沒有預約'); return; }
						handleUpdateAttendance(targetRes.id, action === '3' ? 'present' : 'absent');
						break;
					case '5':
						handleSeatStatus(seat.id, 'maintenance');
						break;
					case '6':
						handleSeatStatus(seat.id, 'available');
						break;
				}
			} else {
				if (!disabled) handleReserve(seat.id);
			}
		};

		return (
			<button 
				key={seat.id}
				disabled={!isAdminView && disabled}
				onClick={handleClick}
				title={`座位 ${seat.seat_number}${seat.note ? ` — ${seat.note}` : ''}`}
				className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all border-2 relative ${bg}`}
			>
				<span>{seat.label}</span>
				{isPillar && <span className="text-[7px] leading-none">柱</span>}
				{isStaff && <span className="text-[7px] leading-none">工</span>}
				{isMaint && <span className="text-[7px] leading-none">🔧</span>}
				{seat.note && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
			</button>
		);
  	};

	const renderZone = (zoneKey: string, zone: { label: string; rows: number[][] }) => (
		<div key={zoneKey} className="bg-card/70 glass-card rounded-xl border border-slate-200 p-3 shadow-sm">
			<div className="text-xs font-bold text-slate-600 mb-2 text-center border-b border-slate-200 pb-1">{zone.label}</div>
			<div className="flex flex-col gap-1">
				{zone.rows.map((row, ri) => (
					<div key={ri} className="flex gap-1 justify-center">
						{row.map(num => renderSeatButton(num))}
					</div>
				))}
			</div>
		</div>
	);

	const renderNewBuilding = () => (
		<div className="space-y-4">
		{/* Top row: 新5-新8 */}
		<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
			{["新5(309)", "新6(306)", "新7(301)", "新8(317)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k]))}
		</div>
		{/* Middle: 中間區 */}
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{["中間區左", "中間區右"].map(k => renderZone(k, NEW_BUILDING_ZONES[k]))}
		</div>
		{/* Bottom: 新3, 新4 */}
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{["新3(311)", "新4(314)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k]))}
		</div>
		{/* Bottom: 新1, 新2 */}
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{["新1(315)", "新2(308)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k]))}
		</div>
		<div className="text-center text-slate-400 font-bold text-sm py-2 border-t border-slate-200">🚪 入口</div>
		</div>
	);

	const renderOldDeskGroup = (zoneKey: string, zone: { label: string; rows: number[][] }) => (
		<div key={zoneKey} className="bg-card/60 glass-card rounded-lg border border-slate-200 p-1.5 shadow-sm">

			{zone.label && <div className="text-[10px] font-bold text-slate-500 mb-1 text-center">{zone.label}</div>}

			<div className="flex flex-col gap-0.5">
				{zone.rows.map((row, ri) => (
					<div key={ri} className="flex gap-0.5 justify-center">
						{row.map(num => renderSeatButton(num))}
					</div>
				))}
			</div>

		</div>
	);

	const renderOldBuilding = () => {
		return (
			<div ref={scrollRef} className="space-y-3 overflow-x-auto pb-2 scrollbar-thin">
				{/* Main seat area - matching physical layout */}
				<div className="min-w-[900px]">
				{/* Top section - main desk groups in columns */}
				<div className="flex gap-3 items-start">
					{/* Column 1: leftmost (150-164) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊左A1", OLD_BUILDING_ZONES["舊左A1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊左A2", OLD_BUILDING_ZONES["舊左A2"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊左A3", OLD_BUILDING_ZONES["舊左A3"])}
					</div>

					{/* Column 2 (165-182) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊左B1", OLD_BUILDING_ZONES["舊左B1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊左B2", OLD_BUILDING_ZONES["舊左B2"])}
					{/* walkway gap */}
					<div className="h-4 flex items-center justify-center">
						<div className="w-full border-t border-dashed border-slate-300" />
					</div>
					{renderOldDeskGroup("舊左B3", OLD_BUILDING_ZONES["舊左B3"])}
					</div>

					{/* Walkway */}
					<div className="w-4 flex items-center justify-center self-stretch">
					<div className="h-full border-l border-dashed border-slate-300" />
					</div>

					{/* Column 3 (183-200) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊中A1", OLD_BUILDING_ZONES["舊中A1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中A2", OLD_BUILDING_ZONES["舊中A2"])}
					<div className="h-4 flex items-center justify-center">
						<div className="w-full border-t border-dashed border-slate-300" />
					</div>
					{renderOldDeskGroup("舊中A3", OLD_BUILDING_ZONES["舊中A3"])}
					</div>

					{/* Column 4 (201-224) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊中B1", OLD_BUILDING_ZONES["舊中B1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中B2", OLD_BUILDING_ZONES["舊中B2"])}
					<div className="h-4 flex items-center justify-center">
						<div className="w-full border-t border-dashed border-slate-300" />
					</div>
					{renderOldDeskGroup("舊中B3", OLD_BUILDING_ZONES["舊中B3"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中B4", OLD_BUILDING_ZONES["舊中B4"])}
					</div>

					{/* Walkway */}
					<div className="w-4 flex items-center justify-center self-stretch">
					<div className="h-full border-l border-dashed border-slate-300" />
					</div>

					{/* Column 5 (225-248) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊中C1", OLD_BUILDING_ZONES["舊中C1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中C2", OLD_BUILDING_ZONES["舊中C2"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中C3", OLD_BUILDING_ZONES["舊中C3"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊中C4", OLD_BUILDING_ZONES["舊中C4"])}
					</div>

					{/* Column 6 (249-272) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊右A1", OLD_BUILDING_ZONES["舊右A1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右A2", OLD_BUILDING_ZONES["舊右A2"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右A3", OLD_BUILDING_ZONES["舊右A3"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右A4", OLD_BUILDING_ZONES["舊右A4"])}
					</div>

					{/* Walkway */}
					<div className="w-4 flex items-center justify-center self-stretch">
					<div className="h-full border-l border-dashed border-slate-300" />
					</div>

					{/* Column 7 (273-296) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊右B1", OLD_BUILDING_ZONES["舊右B1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右B2", OLD_BUILDING_ZONES["舊右B2"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右B3", OLD_BUILDING_ZONES["舊右B3"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊右B4", OLD_BUILDING_ZONES["舊右B4"])}
					</div>

					{/* Column 8: rightmost (297-314) */}
					<div className="flex flex-col gap-1">
					{renderOldDeskGroup("舊最右1", OLD_BUILDING_ZONES["舊最右1"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊最右2", OLD_BUILDING_ZONES["舊最右2"])}
					<div className="h-1" />
					{renderOldDeskGroup("舊最右3", OLD_BUILDING_ZONES["舊最右3"])}
					</div>
				</div>
				</div>

				{/* Staff seats + entrance area (bottom) */}
				<div className="flex gap-4 items-end">
				{/* Staff zone */}
				<div className="bg-amber-50/70 backdrop-blur rounded-xl border border-amber-200 p-3 shadow-sm">
					<div className="text-xs font-bold text-amber-700 mb-2 text-center">工讀生 / 工讀室</div>
						<div className="flex flex-col gap-0.5">
						{Object.entries(OLD_STAFF_ZONES).map(([k, z]) => (
							<div key={k} className="flex gap-0.5 justify-center">
								{z.rows[0].map(num => renderSeatButton(num))}
							</div>
						))}
						</div>
				</div>

				<div className="flex-1" />

				{/* Entrance + direction indicators */}
				<div className="flex flex-col items-center gap-1 text-slate-400 font-bold text-sm pb-2">
					<span>🚪 入口</span>
				</div>

				<div className="flex-1" />

				<div className="flex flex-col items-center gap-1 text-slate-400 font-bold text-sm pb-2">
					<span>往新館 →</span>
				</div>
			</div>
		</div>
		);
	};

	return (
		<>
			{selectedBuilding === '新館' ? renderNewBuilding() : renderOldBuilding()}
		</>
	);
}
