import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SeatData } from '../type';

interface SeatContextType {
    selectedDate: string;
    setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
    
    selectedBuilding: '新館' | '舊館';
    setSelectedBuilding: React.Dispatch<React.SetStateAction<'新館' | '舊館'>>;
    
    seats: SeatData[];
    setSeats: React.Dispatch<React.SetStateAction<SeatData[]>>;
    
    bookedSeatIds: number[];
    setBookedSeatIds: React.Dispatch<React.SetStateAction<number[]>>;
}

const SeatContext = createContext<SeatContextType | undefined>(undefined);

export function SeatProvider({ children }: { children: ReactNode }) {
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const localDate = new Date();
        localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
        return localDate.toISOString().split('T')[0];
    });
    
    const [selectedBuilding, setSelectedBuilding] = useState<'新館' | '舊館'>('新館');
    const [seats, setSeats] = useState<SeatData[]>([]);
    const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([]);

    const value: SeatContextType = {
        selectedDate, setSelectedDate,
        selectedBuilding, setSelectedBuilding,
        seats, setSeats,
        bookedSeatIds, setBookedSeatIds,
    };

    return <SeatContext.Provider value={value}> {children} </SeatContext.Provider>;
}

export function useSeats() {
    const context = useContext(SeatContext);
    if (context === undefined) throw new Error('useSeats must be used within a SeatProvider');
    return context;
}
