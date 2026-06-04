type View = 
    'login' |
    'register' |
    'myreserve' |
    'history' |
    'reserve' |
    'announcements' |
    'admin-reservations' | 'admin-users' | 'admin-seats' | 'admin-attendance' | 'admin-notes' | 'admin-announcements';

type AnnouncementData = { 
    id: number;
    title: string;
    content: string;
    is_pinned: boolean;
    author_name: string;
    created_at: string | null;
    updated_at: string | null
};

type SeatData = { 
    id: number;
    label: string;
    seat_number: number;
    zone: string;
    building: string;
    seat_type: string;
    note: string | null;
    status: string
};

type Reservation = {
    id: number;
    seat_id: number;
    res_date: string;
    user_id: number;
    attendance_status?: string | null;
    created_at?: string | null
};

type AdminReservation = Reservation & { 
    student_id: string;
    student_name: string;
    seat_label: string;
    attendance_status: string | null;
    created_at: string | null;
    updated_at: string | null
};

type HistoryReservation = {
    id: number;
    seat_id: number;
    res_date: string;
    user_id: number;
    attendance_status: string | null;
    seat_label: string;
    seat_zone: string;
    seat_building: string;
    created_at: string | null
};

type StudentUser = {
    id: number;
    student_id: string;
    name: string | null;
    is_admin: boolean
};

type AttendanceEntry = {
    id: number;
    seat_label: string;
    seat_number: number;
    zone: string;
    building: string;
    student_id: string;
    student_name: string;
    attendance_status: string | null
};

type NoteEntry = {
    id: number;
    seat_number: number;
    label: string;
    zone: string;
    building: string;
    note: string
};

type SortKey = 'res_date' | 'student_id' | 'seat_label' | 'created_at' | 'updated_at';

type SortDir = 'asc' | 'desc';

export type { View, AnnouncementData, SeatData, Reservation, AdminReservation, HistoryReservation, StudentUser, AttendanceEntry, NoteEntry, SortKey, SortDir };