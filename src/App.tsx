import { useState, useEffect, useRef } from 'react';
import { Shield, Calendar, LogOut, User, Lock, AlertCircle, RefreshCw, Users, Key, Trash2, Search, Printer, Edit3, Plus, MessageSquare, CheckCircle, XCircle, FileText, ClipboardList, History, Wrench, ArrowUpDown, Megaphone, Pin, Clock, KeyRound } from 'lucide-react';

const API_BASE = '';
const KLIB_KEY = 'test';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

type View = 'login' | 'register' | 'dashboard' | 'history' | 'reserve' | 'announcements' | 'admin-reservations' | 'admin-users' | 'admin-seats' | 'admin-attendance' | 'admin-notes' | 'admin-announcements';
type AnnouncementData = { id: number; title: string; content: string; is_pinned: boolean; author_name: string; created_at: string | null; updated_at: string | null };
type SeatData = { id: number; label: string; seat_number: number; zone: string; building: string; seat_type: string; note: string | null; status: string };
type Reservation = { id: number; seat_id: number; res_date: string; user_id: number; attendance_status?: string | null; created_at?: string | null };
type AdminReservation = Reservation & { student_id: string; student_name: string; seat_label: string; attendance_status: string | null; created_at: string | null; updated_at: string | null };
type HistoryReservation = { id: number; seat_id: number; res_date: string; user_id: number; attendance_status: string | null; seat_label: string; seat_zone: string; seat_building: string; created_at: string | null };
type StudentUser = { id: number; student_id: string; name: string | null; is_admin: boolean };
type AttendanceEntry = { id: number; seat_label: string; seat_number: number; zone: string; building: string; student_id: string; student_name: string; attendance_status: string | null };
type NoteEntry = { id: number; seat_number: number; label: string; zone: string; building: string; note: string };
type SortKey = 'res_date' | 'student_id' | 'seat_label' | 'created_at' | 'updated_at';
type SortDir = 'asc' | 'desc';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (_e) { return null; }
}

// ═══════════════════ Zone Layout Definitions ═══════════════════
// Each zone defines rows of seat numbers matching the physical layout

// ═══════════════════ Simple Markdown Renderer ═══════════════════
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    // Bold & Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    // Unordered list
    .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered list
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-indigo-300 pl-3 text-slate-600 italic my-1">$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-3 border-slate-200" />')
    // Links (block non-http protocols to prevent javascript: XSS)
    .replace(/\[(.+?)\]\((.+?)\)/g, (_: string, text: string, url: string) => {
      if (!/^https?:\/\//i.test(url)) return text;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline">${text}</a>`;
    })
    // Line breaks: double newline = paragraph break, single = <br>
    .replace(/\n\n/g, '</p><p class="my-1">')
    .replace(/\n/g, '<br/>');
  return '<p class="my-1">' + html + '</p>';
}

const NEW_BUILDING_ZONES: Record<string, { label: string; rows: number[][] }> = {
  "新1(315)": { label: "新1(315)", rows: [[9, 10, 11, 12, 13, 14, 15, 16], [1, 2, 3, 4, 5, 6, 7, 8]] },
  "新2(308)": { label: "新2(308)", rows: [[23, 24, 25, 26, 27, 28], [17, 18, 19, 20, 21, 22]] },
  "新3(311)": { label: "新3(311)", rows: [[37, 38, 39, 40, 41, 42, 43], [29, 30, 31, 32, 33, 34, 35]] },
  "新4(314)": { label: "新4(314)", rows: [[51, 52, 53, 54, 55, 56], [45, 46, 47, 48, 49, 50]] },
  "中間區左": { label: "中間區", rows: [[65, 66, 67, 68, 69, 70, 71, 72], [57, 58, 59, 60, 61, 62, 63, 64]] },
  "中間區右": { label: "中間區", rows: [[79, 80, 81, 82, 83, 84], [73, 74, 75, 76, 77, 78]] },
  "新5(309)": { label: "新5(309)", rows: [[85, 92], [86, 93], [87, 94], [88, 95], [89, 96], [90, 97], [91, 98]] },
  "新6(306)": { label: "新6(306)", rows: [[99, 106], [100, 107], [101, 108], [102, 109], [103, 110], [104, 111], [105, 112]] },
  "新7(301)": { label: "新7(301)", rows: [[113, 120], [114, 121], [115, 122], [116, 123], [117, 124], [118, 125], [119, 126]] },
  "新8(317)": { label: "新8(317)", rows: [[127, 134], [128, 135], [129, 136], [130, 137], [131, 138], [132, 139], [133, 140]] },
};

// ═══════════════════ Old Building Zone Layout ═══════════════════
// Based on the physical seat map (舊館座位表)
// Layout is arranged as desk groups separated by walkways

// Staff seats (bottom-left of map)
const OLD_STAFF_ZONES = {
  "工讀生1": { label: "工讀生", rows: [[141, 142, 143]] },
  "工讀生2": { label: "工讀生", rows: [[144, 145, 146]] },
  "工讀室": { label: "工讀室", rows: [[147, 148, 149]] },
};

// Old building desk groups — each group is a cluster of desks
// Columns go left to right, rows go top to bottom (matching the physical image)
const OLD_BUILDING_ZONES: Record<string, { label: string; rows: number[][] }> = {
  // ─── Left Column (leftmost 3-seat wide desks, 150-164) ───
  "舊左A1": {
    label: "", rows: [
      [162, 163, 164],
      [159, 160, 161],
    ]
  },
  "舊左A2": {
    label: "", rows: [
      [156, 157, 158],
      [153, 154, 155],
    ]
  },
  "舊左A3": {
    label: "", rows: [
      [150, 151, 152],
    ]
  },
  // ─── Left-Center Column (165-182) ───
  "舊左B1": {
    label: "", rows: [
      [180, 181, 182],
      [177, 178, 179],
    ]
  },
  "舊左B2": {
    label: "", rows: [
      [174, 175, 176],
      [171, 172, 173],
    ]
  },
  "舊左B3": {
    label: "", rows: [
      [168, 169, 170],
      [165, 166, 167],
    ]
  },
  // ─── Center-Left Columns (183-200) ───
  "舊中A1": {
    label: "", rows: [
      [198, 199, 200],
      [195, 196, 197],
    ]
  },
  "舊中A2": {
    label: "", rows: [
      [192, 193, 194],
      [189, 190, 191],
    ]
  },
  "舊中A3": {
    label: "", rows: [
      [186, 187, 188],
      [183, 184, 185],
    ]
  },
  // ─── Center Columns (201-224) ───
  "舊中B1": {
    label: "", rows: [
      [222, 223, 224],
      [219, 220, 221],
    ]
  },
  "舊中B2": {
    label: "", rows: [
      [216, 217, 218],
      [213, 214, 215],
    ]
  },
  "舊中B3": {
    label: "", rows: [
      [210, 211, 212],
      [207, 208, 209],
    ]
  },
  "舊中B4": {
    label: "", rows: [
      [204, 205, 206],
      [201, 202, 203],
    ]
  },
  // ─── Center-Right (225-248) ───
  "舊中C1": {
    label: "", rows: [
      [246, 247, 248],
      [243, 244, 245],
    ]
  },
  "舊中C2": {
    label: "", rows: [
      [240, 241, 242],
      [237, 238, 239],
    ]
  },
  "舊中C3": {
    label: "", rows: [
      [234, 235, 236],
      [231, 232, 233],
    ]
  },
  "舊中C4": {
    label: "", rows: [
      [228, 229, 230],
      [225, 226, 227],
    ]
  },
  // ─── Right columns (249-272) ───
  "舊右A1": {
    label: "", rows: [
      [270, 271, 272],
      [267, 268, 269],
    ]
  },
  "舊右A2": {
    label: "", rows: [
      [264, 265, 266],
      [261, 262, 263],
    ]
  },
  "舊右A3": {
    label: "", rows: [
      [258, 259, 260],
      [255, 256, 257],
    ]
  },
  "舊右A4": {
    label: "", rows: [
      [252, 253, 254],
      [249, 250, 251],
    ]
  },
  // ─── Far-Right (273-296) ───
  "舊右B1": {
    label: "", rows: [
      [294, 295, 296],
      [291, 292, 293],
    ]
  },
  "舊右B2": {
    label: "", rows: [
      [288, 289, 290],
      [285, 286, 287],
    ]
  },
  "舊右B3": {
    label: "", rows: [
      [282, 283, 284],
      [279, 280, 281],
    ]
  },
  "舊右B4": {
    label: "", rows: [
      [276, 277, 278],
      [273, 274, 275],
    ]
  },
  // ─── Rightmost columns (297-314) ───  
  "舊最右1": {
    label: "", rows: [
      [312, 313, 314],
      [309, 310, 311],
    ]
  },
  "舊最右2": {
    label: "", rows: [
      [306, 307, 308],
      [303, 304, 305],
    ]
  },
  "舊最右3": {
    label: "", rows: [
      [300, 301, 302],
      [297, 298, 299],
    ]
  },
};

export default function App() {
  const [view, setView] = useState<View>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedBuilding, setSelectedBuilding] = useState<'新館' | '舊館'>('新館');
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [myHistory, setMyHistory] = useState<HistoryReservation[]>([]);

  const [allReservations, setAllReservations] = useState<AdminReservation[]>([]);
  const [allUsers, setAllUsers] = useState<StudentUser[]>([]);
  const [resetStudentId, setResetStudentId] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSeatNote, setEditingSeatNote] = useState<SeatData | null>(null);
  const [noteText, setNoteText] = useState('');

  // Admin reserve modal
  const [showAdminReserve, setShowAdminReserve] = useState(false);
  const [adminReserveSeatId, setAdminReserveSeatId] = useState<number | null>(null);
  const [adminReserveStudentId, setAdminReserveStudentId] = useState('');
  const [adminReserveDate, setAdminReserveDate] = useState(new Date().toISOString().split('T')[0]);

  // Attendance & notes
  const [attendanceList, setAttendanceList] = useState<AttendanceEntry[]>([]);
  const [notesList, setNotesList] = useState<NoteEntry[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('res_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [reservationSearch, setReservationSearch] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementData | null>(null);

  // Admin change password
  const [adminOldPw, setAdminOldPw] = useState('');
  const [adminNewPw, setAdminNewPw] = useState('');
  const [adminConfirmPw, setAdminConfirmPw] = useState('');

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    const headers: any = { 'Content-Type': 'application/json', 'X-KLib-Key': KLIB_KEY };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(res.ok ? text : `伺服器錯誤 (${res.status})`); }
      if (!res.ok) throw new Error(data.detail || '請求失敗');
      return data;
    } catch (err: any) { setError(err.message); throw err; }
  };

  useEffect(() => {
    fetchAnnouncements();
    if (token) {
      const payload = decodeJwtPayload(token);
      // Check if token is expired
      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        handleLogout();
        return;
      }
      const admin = payload?.admin === true;
      setIsAdmin(admin);
      setUserName(payload?.name || payload?.sub || '');
      setView(admin ? 'admin-reservations' : 'dashboard');
      fetchSeats();
      if (!admin) fetchMyReservations();
    }
  }, [token]);

  useEffect(() => {
    if (view === 'reserve' || view === 'admin-seats') { fetchSeats(); fetchAvailability(); }
    if (view === 'admin-reservations') fetchAdminReservations();
    if (view === 'admin-users') fetchAdminUsers();
    if (view === 'admin-attendance') fetchAttendanceList();
    if (view === 'admin-notes') fetchNotesList();
    if (view === 'dashboard') { fetchMyReservations(); fetchSeats(); }
    if (view === 'history') fetchMyHistory();
    if (view === 'announcements' || view === 'admin-announcements') fetchAnnouncements();
  }, [view, selectedDate]);

  const handleLogin = async (e: any) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', studentId); formData.append('password', password);
      const res = await fetch(`${API_BASE}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-KLib-Key': KLIB_KEY }, body: formData });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error(`伺服器錯誤 (${res.status})`); }
      if (!res.ok) throw new Error(data.detail);
      localStorage.setItem('token', data.access_token); setToken(data.access_token);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // Google Sign-In: render official button into a container div
  useEffect(() => {
    if (token || !GOOGLE_CLIENT_ID) return;
    const w = window as any;
    const initGoogle = () => {
      if (!w.google?.accounts?.id) return;
      w.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          setLoading(true); setError(null);
          try {
            const data = await apiCall('/api/auth/google', 'POST', { credential: response.credential });
            localStorage.setItem('token', data.access_token); setToken(data.access_token);
          } catch (err: any) { setError(err.message); } finally { setLoading(false); }
        },
        hd: 'fssh.khc.edu.tw',
      });
      const container = document.getElementById('google-signin-btn');
      if (container) {
        w.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: 380,
          text: 'signin_with',
          locale: 'zh-TW',
        });
      }
    };
    // SDK might not be loaded yet (async script), so retry
    if (w.google?.accounts?.id) { initGoogle(); }
    else { const timer = setInterval(() => { if (w.google?.accounts?.id) { clearInterval(timer); initGoogle(); } }, 200); return () => clearInterval(timer); }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token'); setToken(null); setIsAdmin(false);
    setStudentId(''); setPassword(''); setView('login');
  };

  const fetchSeats = async () => { try { setSeats(await apiCall('/api/seats')); } catch { } };
  const fetchAvailability = async () => { try { setBookedSeatIds(await apiCall(`/api/availability?res_date=${selectedDate}`)); } catch { } };
  const fetchMyReservations = async () => { try { setMyReservations(await apiCall('/api/my-reservations')); } catch { } };
  const fetchMyHistory = async () => { try { setMyHistory(await apiCall('/api/my-history')); } catch { } };
  const fetchAdminReservations = async () => { try { setAllReservations(await apiCall('/api/admin/reservations')); } catch { } };
  const fetchAdminUsers = async () => { try { setAllUsers(await apiCall('/api/admin/users')); } catch { } };
  const fetchAttendanceList = async () => { try { setAttendanceList(await apiCall(`/api/admin/attendance?date=${selectedDate}`)); } catch { } };
  const fetchNotesList = async () => { try { setNotesList(await apiCall('/api/admin/notes')); } catch { } };
  const fetchAnnouncements = async () => {
    try {
      const headers: any = { 'Content-Type': 'application/json', 'X-KLib-Key': KLIB_KEY };
      const res = await fetch(`${API_BASE}/api/announcements`, { headers });
      const data = await res.json();
      setAnnouncements(data);
    } catch { }
  };
  const handleCreateAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) { setAdminMessage('標題和內容不能為空'); return; }
    try {
      await apiCall('/api/admin/announcements', 'POST', { title: annTitle, content: annContent, is_pinned: annPinned });
      setAdminMessage('公告已發布'); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); fetchAnnouncements();
    } catch (err: any) { setAdminMessage(`發布失敗: ${err.message}`); }
  };
  const handleUpdateAnnouncement = async () => {
    if (!editingAnn) return;
    try {
      await apiCall(`/api/admin/announcements/${editingAnn.id}`, 'PUT', { title: annTitle, content: annContent, is_pinned: annPinned });
      setAdminMessage('公告已更新'); setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); fetchAnnouncements();
    } catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
  };
  const handleDeleteAnnouncement = async (id: number) => {
    if (!window.confirm('確定要刪除這則公告嗎？')) return;
    try { await apiCall(`/api/admin/announcements/${id}`, 'DELETE'); setAdminMessage('公告已刪除'); fetchAnnouncements(); }
    catch (err: any) { setAdminMessage(`刪除失敗: ${err.message}`); }
  };

  const handleReserve = async (seatId: number) => {
    if (!window.confirm('確定要預約這個座位嗎？')) return;
    setLoading(true);
    try { await apiCall('/api/reserve', 'POST', { seat_id: seatId, res_date: selectedDate }); alert('預約成功！'); fetchAvailability(); fetchMyReservations(); }
    catch (err: any) { alert(`預約失敗: ${err.message}`); } finally { setLoading(false); }
  };

  const handleCancel = async (resId: number) => {
    if (!window.confirm('確定要取消這個預約嗎？')) return;
    try { await apiCall(`/api/reservations/${resId}`, 'DELETE'); fetchMyReservations(); } catch (err: any) { alert(`無法取消：${err.message}`); }
  };

  const handleAdminCancelReservation = async (resId: number) => {
    if (!window.confirm('確定要取消這個學生的預約嗎？')) return;
    try { await apiCall(`/api/admin/reservations/${resId}`, 'DELETE'); setAdminMessage('已成功取消預約'); fetchAdminReservations(); }
    catch (err: any) { setAdminMessage(`取消失敗: ${err.message}`); }
  };

  const handleResetPassword = async (sid?: string) => {
    const targetId = sid || resetStudentId;
    if (!targetId) { setAdminMessage('請輸入學號'); return; }
    let newPw = sid ? '' : resetNewPassword;
    if (sid) { const input = window.prompt(`請輸入 ${sid} 的新密碼：`); if (!input) return; newPw = input; }
    if (!newPw) { setAdminMessage('請輸入新密碼'); return; }
    try { const result = await apiCall('/api/admin/reset-password', 'PUT', { student_id: targetId, new_password: newPw }); setAdminMessage(result.message); setResetStudentId(''); setResetNewPassword(''); }
    catch (err: any) { setAdminMessage(`重設失敗: ${err.message}`); }
  };

  const handleAdminChangePassword = async () => {
    if (!adminOldPw) { setAdminMessage('請輸入舊密碼'); return; }
    if (!adminNewPw) { setAdminMessage('請輸入新密碼'); return; }
    if (!adminConfirmPw) { setAdminMessage('請再次輸入新密碼確認'); return; }
    if (adminNewPw !== adminConfirmPw) { setAdminMessage('兩次輸入的新密碼不一致'); return; }
    if (!window.confirm('⚠️ 確定要修改管理員密碼嗎？\n\n修改後需要使用新密碼重新登入。')) return;
    try {
      const result = await apiCall('/api/admin/change-password', 'PUT', { old_password: adminOldPw, new_password: adminNewPw, confirm_password: adminConfirmPw });
      setAdminMessage(result.message);
      setAdminOldPw(''); setAdminNewPw(''); setAdminConfirmPw('');
    } catch (err: any) { setAdminMessage(`修改失敗: ${err.message}`); }
  };

  const handleSaveSeatNote = async () => {
    if (!editingSeatNote) return;
    try { await apiCall(`/api/admin/seats/${editingSeatNote.id}/note`, 'PUT', { note: noteText }); setEditingSeatNote(null); fetchSeats(); setAdminMessage('註記已更新'); }
    catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
  };

  const handleAdminReserve = async () => {
    if (!adminReserveSeatId || !adminReserveStudentId) return;
    try { const result = await apiCall('/api/admin/reserve', 'POST', { student_id: adminReserveStudentId, seat_id: adminReserveSeatId, res_date: adminReserveDate }); setAdminMessage(result.message); setShowAdminReserve(false); fetchAvailability(); fetchAdminReservations(); }
    catch (err: any) { setAdminMessage(`預約失敗: ${err.message}`); }
  };

  const handleUpdateAttendance = async (reservationId: number, status: 'present' | 'absent') => {
    try {
      const result = await apiCall(`/api/admin/reservations/${reservationId}/attendance`, 'PUT', { status });
      setAdminMessage(result.message);
      fetchAttendanceList();
      fetchAdminReservations();
    } catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
  };

  const handlePrintAttendance = async () => {
    try {
      const data: AttendanceEntry[] = await apiCall(`/api/admin/attendance?date=${selectedDate}`);
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(`<!DOCTYPE html><html><head><title>出席名單 ${selectedDate}</title><style>
        body{font-family:'Microsoft JhengHei',sans-serif;padding:20px}
        h1{text-align:center;font-size:20px;margin-bottom:4px}
        h2{text-align:center;font-size:14px;color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:6px 10px;text-align:center;font-size:13px}
        th{background:#f0f0f0;font-weight:bold}
        @media print{button{display:none}}
      </style></head><body>
      <h1>鳳山高中 K書中心 出席名單</h1>
      <h2>日期：${selectedDate}　　共 ${data.length} 人</h2>
      <table><thead><tr><th>座位號碼</th><th>區域</th><th>館別</th><th>學號</th><th>姓名</th></tr></thead><tbody>
      ${data.map(d => `<tr><td>${escapeHtml(d.seat_label)}</td><td>${escapeHtml(d.zone)}</td><td>${escapeHtml(d.building)}</td><td>${escapeHtml(d.student_id)}</td><td>${escapeHtml(d.student_name)}</td></tr>`).join('')}
      </tbody></table>
      <br><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">🖨️ 列印</button>
      </body></html>`);
      printWindow.document.close();
    } catch (err: any) { setAdminMessage(`無法取得出席名單: ${err.message}`); }
  };

  const handleSeatStatus = async (seatId: number, newStatus: 'maintenance' | 'available') => {
    const action = newStatus === 'maintenance' ? '設為維修中（會自動取消該座位未來的所有預約）' : '恢復為可用';
    if (!window.confirm(`確定要${action}嗎？`)) return;
    try {
      const result = await apiCall(`/api/admin/seats/${seatId}/status`, 'PUT', { status: newStatus });
      setAdminMessage(result.message);
      fetchSeats();
      fetchAvailability();
      fetchAdminReservations();
    } catch (err: any) { setAdminMessage(`操作失敗: ${err.message}`); }
  };

  // ═══════════ Seat Rendering Helper ═══════════
  const seatMap = new Map<number, SeatData>(seats.map(s => [s.seat_number, s]));

  const renderSeatButton = (seatNum: number, isAdminView: boolean) => {
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
      if (isAdminView) {
        if (isPillar && !isReservablePillar) return;
        const statusText = isMaint ? '維修中' : isBooked ? '已預約' : isStaff ? '工讀生' : '空位';
        const action = window.prompt(`座位 ${seat.label}\n${seat.note ? `註記: ${seat.note}\n` : ''}狀態: ${statusText}\n\n輸入操作：\n1 = 編輯註記\n2 = 代為預約\n3 = 有到\n4 = 未到\n5 = 設為維修中\n6 = 恢復可用\n取消 = 關閉`);
        if (action === '1') { setEditingSeatNote(seat); setNoteText(seat.note || ''); }
        else if (action === '2') { setAdminReserveSeatId(seat.id); setAdminReserveStudentId(''); setAdminReserveDate(selectedDate); setShowAdminReserve(true); }
        else if (action === '3' || action === '4') {
          const targetRes = allReservations.find(r => r.seat_id === seat.id && r.res_date === selectedDate);
          if (!targetRes) { alert('該座位在這個日期沒有預約'); return; }
          handleUpdateAttendance(targetRes.id, action === '3' ? 'present' : 'absent');
        }
        else if (action === '5') { handleSeatStatus(seat.id, 'maintenance'); }
        else if (action === '6') { handleSeatStatus(seat.id, 'available'); }
      } else {
        if (!disabled) handleReserve(seat.id);
      }
    };

    return (
      <button key={seat.id} disabled={!isAdminView && disabled} onClick={handleClick} title={`座位 ${seat.seat_number}${seat.note ? ` — ${seat.note}` : ''}`}
        className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all border-2 relative ${bg}`}>
        <span>{seat.label}</span>
        {isPillar && <span className="text-[7px] leading-none">柱</span>}
        {isStaff && <span className="text-[7px] leading-none">工</span>}
        {isMaint && <span className="text-[7px] leading-none">🔧</span>}
        {seat.note && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
      </button>
    );
  };

  const renderZone = (zoneKey: string, zone: { label: string; rows: number[][] }, isAdminView: boolean) => (
    <div key={zoneKey} className="bg-white/70 backdrop-blur rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="text-xs font-bold text-slate-600 mb-2 text-center border-b border-slate-100 pb-1">{zone.label}</div>
      <div className="flex flex-col gap-1">
        {zone.rows.map((row, ri) => (
          <div key={ri} className="flex gap-1 justify-center">
            {row.map(num => renderSeatButton(num, isAdminView))}
          </div>
        ))}
      </div>
    </div>
  );

  const renderNewBuilding = (isAdminView: boolean) => (
    <div className="space-y-4">
      {/* Top row: 新5-新8 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["新5(309)", "新6(306)", "新7(301)", "新8(317)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k], isAdminView))}
      </div>
      {/* Middle: 中間區 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {["中間區左", "中間區右"].map(k => renderZone(k, NEW_BUILDING_ZONES[k], isAdminView))}
      </div>
      {/* Bottom: 新3, 新4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {["新3(311)", "新4(314)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k], isAdminView))}
      </div>
      {/* Bottom: 新1, 新2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {["新1(315)", "新2(308)"].map(k => renderZone(k, NEW_BUILDING_ZONES[k], isAdminView))}
      </div>
      <div className="text-center text-slate-400 font-bold text-sm py-2 border-t border-slate-200">🚪 入口</div>
    </div>
  );

  const renderOldDeskGroup = (zoneKey: string, zone: { label: string; rows: number[][] }, isAdminView: boolean) => (
    <div key={zoneKey} className="bg-white/60 backdrop-blur rounded-lg border border-slate-200 p-1.5 shadow-sm">
      {zone.label && <div className="text-[10px] font-bold text-slate-500 mb-1 text-center">{zone.label}</div>}
      <div className="flex flex-col gap-0.5">
        {zone.rows.map((row, ri) => (
          <div key={ri} className="flex gap-0.5 justify-center">
            {row.map(num => renderSeatButton(num, isAdminView))}
          </div>
        ))}
      </div>
    </div>
  );

  const renderOldBuilding = (isAdminView: boolean) => {
    return (
      <div className="space-y-3 overflow-x-auto">
        {/* Main seat area - matching physical layout */}
        <div className="min-w-[900px]">
          {/* Top section - main desk groups in columns */}
          <div className="flex gap-3 items-start">
            {/* Column 1: leftmost (150-164) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊左A1", OLD_BUILDING_ZONES["舊左A1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊左A2", OLD_BUILDING_ZONES["舊左A2"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊左A3", OLD_BUILDING_ZONES["舊左A3"], isAdminView)}
            </div>

            {/* Column 2 (165-182) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊左B1", OLD_BUILDING_ZONES["舊左B1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊左B2", OLD_BUILDING_ZONES["舊左B2"], isAdminView)}
              {/* walkway gap */}
              <div className="h-4 flex items-center justify-center">
                <div className="w-full border-t border-dashed border-slate-300" />
              </div>
              {renderOldDeskGroup("舊左B3", OLD_BUILDING_ZONES["舊左B3"], isAdminView)}
            </div>

            {/* Walkway */}
            <div className="w-4 flex items-center justify-center self-stretch">
              <div className="h-full border-l border-dashed border-slate-300" />
            </div>

            {/* Column 3 (183-200) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊中A1", OLD_BUILDING_ZONES["舊中A1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中A2", OLD_BUILDING_ZONES["舊中A2"], isAdminView)}
              <div className="h-4 flex items-center justify-center">
                <div className="w-full border-t border-dashed border-slate-300" />
              </div>
              {renderOldDeskGroup("舊中A3", OLD_BUILDING_ZONES["舊中A3"], isAdminView)}
            </div>

            {/* Column 4 (201-224) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊中B1", OLD_BUILDING_ZONES["舊中B1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中B2", OLD_BUILDING_ZONES["舊中B2"], isAdminView)}
              <div className="h-4 flex items-center justify-center">
                <div className="w-full border-t border-dashed border-slate-300" />
              </div>
              {renderOldDeskGroup("舊中B3", OLD_BUILDING_ZONES["舊中B3"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中B4", OLD_BUILDING_ZONES["舊中B4"], isAdminView)}
            </div>

            {/* Walkway */}
            <div className="w-4 flex items-center justify-center self-stretch">
              <div className="h-full border-l border-dashed border-slate-300" />
            </div>

            {/* Column 5 (225-248) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊中C1", OLD_BUILDING_ZONES["舊中C1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中C2", OLD_BUILDING_ZONES["舊中C2"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中C3", OLD_BUILDING_ZONES["舊中C3"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊中C4", OLD_BUILDING_ZONES["舊中C4"], isAdminView)}
            </div>

            {/* Column 6 (249-272) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊右A1", OLD_BUILDING_ZONES["舊右A1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右A2", OLD_BUILDING_ZONES["舊右A2"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右A3", OLD_BUILDING_ZONES["舊右A3"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右A4", OLD_BUILDING_ZONES["舊右A4"], isAdminView)}
            </div>

            {/* Walkway */}
            <div className="w-4 flex items-center justify-center self-stretch">
              <div className="h-full border-l border-dashed border-slate-300" />
            </div>

            {/* Column 7 (273-296) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊右B1", OLD_BUILDING_ZONES["舊右B1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右B2", OLD_BUILDING_ZONES["舊右B2"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右B3", OLD_BUILDING_ZONES["舊右B3"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊右B4", OLD_BUILDING_ZONES["舊右B4"], isAdminView)}
            </div>

            {/* Column 8: rightmost (297-314) */}
            <div className="flex flex-col gap-1">
              {renderOldDeskGroup("舊最右1", OLD_BUILDING_ZONES["舊最右1"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊最右2", OLD_BUILDING_ZONES["舊最右2"], isAdminView)}
              <div className="h-1" />
              {renderOldDeskGroup("舊最右3", OLD_BUILDING_ZONES["舊最右3"], isAdminView)}
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
                  {z.rows[0].map(num => renderSeatButton(num, isAdminView))}
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

  // ═══════════ Legend ═══════════
  const renderLegend = () => (
    <div className="flex flex-wrap gap-3 text-xs">
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

  const formatTime = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (d: Date) => d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });

  // ═══════════ Login Page ═══════════
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4">
        {/* Clock bar */}
        <div className="text-center mb-6 pt-4">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur rounded-full px-6 py-2 shadow-sm border border-slate-100">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-slate-700">{formatDate(currentTime)}</span>
            <span className="text-lg font-bold text-indigo-600 font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto items-start justify-center">
          {/* Login form */}
          <div className="w-full max-w-md bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 border border-slate-100">
            <div className="flex items-center gap-2 mb-8">
              <Shield className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">鳳山高中 K書中心</h1>
            </div>

            {GOOGLE_CLIENT_ID && (
              <div className="mb-4">
                <div id="google-signin-btn" className="flex justify-center" />
              </div>
            )}

            {GOOGLE_CLIENT_ID && <div className="text-center text-xs text-slate-400 mb-4">── 或使用帳號密碼 ──</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">學號</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={studentId} onChange={e => setStudentId(e.target.value)} required placeholder="輸入學號" className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">密碼</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="輸入密碼" className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 transition">
                {loading ? '登入中...' : '登入'}
              </button>
            </form>
          </div>

          {/* Announcements on login page */}
          {announcements.length > 0 && (
            <div className="w-full max-w-md bg-white/80 backdrop-blur rounded-2xl shadow-xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Megaphone className="w-5 h-5 text-amber-500" />公告欄
              </h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {announcements.slice(0, 5).map(ann => (
                  <div key={ann.id} className={`rounded-xl p-4 border ${ann.is_pinned ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50/80 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {ann.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="font-bold text-sm text-slate-900">{ann.title}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{ann.author_name} · {ann.created_at}</div>
                    <div className="prose-sm text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════ Main App ═══════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 font-sans">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-slate-900">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <span className="hidden sm:inline">K書中心{isAdmin ? '管理後台' : '預約系統'}</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-full px-3 py-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatDate(currentTime)}</span>
              <span className="font-bold text-indigo-600 font-mono">{formatTime(currentTime)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm">
            {isAdmin ? (<>
              <button onClick={() => setView('admin-reservations')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-reservations' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar className="w-4 h-4 inline mr-1" />預約</button>
              <button onClick={() => setView('admin-attendance')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-attendance' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><ClipboardList className="w-4 h-4 inline mr-1" />出席</button>
              <button onClick={() => setView('admin-seats')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-seats' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><MessageSquare className="w-4 h-4 inline mr-1" />座位</button>
              <button onClick={() => setView('admin-notes')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-notes' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><FileText className="w-4 h-4 inline mr-1" />註記</button>
              <button onClick={() => setView('admin-users')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-users' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><Users className="w-4 h-4 inline mr-1" />學生</button>
              <button onClick={() => setView('admin-announcements')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'admin-announcements' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}><Megaphone className="w-4 h-4 inline mr-1" />公告</button>
            </>) : (<>
              <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>我的預約</button>
              <button onClick={() => setView('history')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'history' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><History className="w-4 h-4 inline mr-1" />歷史紀錄</button>
              <button onClick={() => setView('reserve')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'reserve' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>預約座位</button>
              <button onClick={() => setView('announcements')} className={`px-3 py-1.5 rounded-lg font-medium transition ${view === 'announcements' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><Megaphone className="w-4 h-4 inline mr-1" />公告</button>
            </>)}
            <button onClick={handleLogout} className="ml-1 text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ===== Admin: Reservation Management ===== */}
        {view === 'admin-reservations' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-6 h-6 text-amber-600" />全部預約紀錄</h2>
              <div className="flex items-center gap-2">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                <button onClick={handlePrintAttendance} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><Printer className="w-4 h-4" />列印出席名單</button>
                <button onClick={fetchAdminReservations} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </div>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}
            {/* Search bar */}
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
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
            {allReservations.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">目前沒有任何預約紀錄</div>
            ) : (
              <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 overflow-hidden">
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
                    {[...allReservations]
                      .filter(res => {
                        if (!reservationSearch.trim()) return true;
                        const q = reservationSearch.trim().toLowerCase();
                        return (
                          res.student_id.toLowerCase().includes(q) ||
                          res.student_name.toLowerCase().includes(q) ||
                          res.seat_label.toLowerCase().includes(q) ||
                          res.res_date.includes(q)
                        );
                      })
                      .sort((a, b) => { const av = (a as any)[sortKey] || ''; const bv = (b as any)[sortKey] || ''; return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av)); }).map(res => (
                      <tr key={res.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-indigo-700">{res.student_id}</td>
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
            )}
          </div>
        )}

        {/* ===== Admin: Daily Attendance ===== */}
        {view === 'admin-attendance' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-amber-600" />每日出席狀況</h2>
              <div className="flex items-center gap-2">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                <button onClick={handlePrintAttendance} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><Printer className="w-4 h-4" />列印</button>
                <button onClick={fetchAttendanceList} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </div>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/70 backdrop-blur rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-indigo-700">{attendanceList.length}</div>
                <div className="text-xs text-slate-500 mt-1">總預約人數</div>
              </div>
              <div className="bg-emerald-50/70 backdrop-blur rounded-xl border border-emerald-200 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{attendanceList.filter(a => a.attendance_status === 'present').length}</div>
                <div className="text-xs text-emerald-600 mt-1">✅ 有到</div>
              </div>
              <div className="bg-red-50/70 backdrop-blur rounded-xl border border-red-200 p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{attendanceList.filter(a => a.attendance_status === 'absent').length}</div>
                <div className="text-xs text-red-500 mt-1">❌ 未到</div>
              </div>
              <div className="bg-slate-50/70 backdrop-blur rounded-xl border border-slate-200 p-4 text-center">
                <div className="text-2xl font-bold text-slate-500">{attendanceList.filter(a => !a.attendance_status).length}</div>
                <div className="text-xs text-slate-500 mt-1">⏳ 未點名</div>
              </div>
            </div>

            {attendanceList.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">該日期沒有任何預約</div>
            ) : (
              <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">座位</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">區域</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">館別</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-700">出席狀態</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceList.map(entry => (
                      <tr key={entry.id} className={`transition ${entry.attendance_status === 'present' ? 'bg-emerald-50/30' : entry.attendance_status === 'absent' ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3 font-bold">{entry.seat_label}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.zone}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.building}</td>
                        <td className="px-4 py-3 font-medium text-indigo-700">{entry.student_id}</td>
                        <td className="px-4 py-3 text-slate-600">{entry.student_name}</td>
                        <td className="px-4 py-3 text-center">
                          {entry.attendance_status === 'present' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" />有到</span>}
                          {entry.attendance_status === 'absent' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-bold"><XCircle className="w-3.5 h-3.5" />未到</span>}
                          {!entry.attendance_status && <span className="text-slate-400 text-xs">⏳ 未點名</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
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
        )}

        {/* ===== Admin: Notes List ===== */}
        {view === 'admin-notes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="w-6 h-6 text-amber-600" />座位註記總覽</h2>
              <button onClick={fetchNotesList} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}

            {notesList.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">目前沒有任何座位有註記</div>
            ) : (
              <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 font-medium">共 {notesList.length} 個座位有註記</div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">座位號碼</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">區域</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">館別</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">註記內容</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notesList.map(n => (
                      <tr key={n.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-bold text-indigo-700">{n.seat_number}</td>
                        <td className="px-4 py-3 text-slate-600">{n.zone}</td>
                        <td className="px-4 py-3 text-slate-600">{n.building}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs"><MessageSquare className="w-3 h-3" />{n.note}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { const seat = seats.find(s => s.id === n.id); if (seat) { setEditingSeatNote(seat); setNoteText(seat.note || ''); } }} className="text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 text-xs font-bold transition"><Edit3 className="w-3 h-3 inline mr-1" />編輯</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== Admin: Seat Map with Notes ===== */}
        {view === 'admin-seats' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="w-6 h-6 text-amber-600" />座位地圖管理</h2>
              <div className="flex items-center gap-2">
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
                <button onClick={() => { fetchSeats(); fetchAvailability(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
              </div>
            </div>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}
            {renderLegend()}
            <div className="flex gap-2 mb-2">
              <button onClick={() => setSelectedBuilding('新館')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${selectedBuilding === '新館' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>新館</button>
              <button onClick={() => setSelectedBuilding('舊館')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${selectedBuilding === '舊館' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>舊館</button>
            </div>
            <div className="bg-gradient-to-br from-slate-100/50 to-indigo-50/50 rounded-2xl border border-slate-200 p-4">
              {selectedBuilding === '新館' ? renderNewBuilding(true) : renderOldBuilding(true)}
            </div>
          </div>
        )}

        {/* ===== Admin: User Management ===== */}
        {view === 'admin-users' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" />學生帳號管理</h2>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}
            <div className="bg-white/70 backdrop-blur p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-amber-600" /> 重設學生密碼</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[180px] space-y-1"><label className="text-sm font-medium text-slate-600">學號</label><input type="text" value={resetStudentId} onChange={e => setResetStudentId(e.target.value)} placeholder="輸入學號" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" /></div>
                <div className="flex-1 min-w-[180px] space-y-1"><label className="text-sm font-medium text-slate-600">新密碼</label><input type="text" value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} placeholder="輸入新密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" /></div>
                <button onClick={() => handleResetPassword()} className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-2 rounded-lg transition"><Key className="w-4 h-4 inline mr-1" />重設</button>
              </div>
            </div>
            <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center gap-3"><Search className="w-4 h-4 text-slate-400" /><input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜尋學號..." className="flex-1 outline-none text-sm bg-transparent" /></div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="px-4 py-3 text-left font-bold text-slate-700">學號</th><th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th><th className="px-4 py-3 text-right font-bold text-slate-700">操作</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers.filter(u => u.student_id.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-indigo-700">{u.student_id}</td>
                      <td className="px-4 py-3 text-slate-600">{u.name || '未填寫'}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => handleResetPassword(u.student_id)} className="text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 text-xs font-bold transition"><Key className="w-3 h-3 inline mr-1" />重設密碼</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Admin change own password */}
            <div className="bg-white/70 backdrop-blur p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-indigo-600" /> 修改管理員密碼</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[160px] space-y-1">
                  <label className="text-sm font-medium text-slate-600">舊密碼</label>
                  <input type="password" value={adminOldPw} onChange={e => setAdminOldPw(e.target.value)} placeholder="輸入目前密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div className="flex-1 min-w-[160px] space-y-1">
                  <label className="text-sm font-medium text-slate-600">新密碼</label>
                  <input type="password" value={adminNewPw} onChange={e => setAdminNewPw(e.target.value)} placeholder="輸入新密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <div className="flex-1 min-w-[160px] space-y-1">
                  <label className="text-sm font-medium text-slate-600">確認新密碼</label>
                  <input type="password" value={adminConfirmPw} onChange={e => setAdminConfirmPw(e.target.value)} placeholder="再次輸入新密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
                <button onClick={handleAdminChangePassword} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-lg transition flex items-center gap-1"><KeyRound className="w-4 h-4" />修改密碼</button>
              </div>
              {adminNewPw && adminConfirmPw && adminNewPw !== adminConfirmPw && (
                <div className="mt-2 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />兩次輸入的新密碼不一致</div>
              )}
            </div>
          </div>
        )}

        {/* ===== Student: Dashboard ===== */}
        {view === 'dashboard' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">我的預約紀錄</h2>
            {myReservations.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">目前沒有預約，快去搶位子吧！</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myReservations.map(res => {
                  const seat = seats.find(s => s.id === res.seat_id);
                  return (
                    <div key={res.id} className="bg-white/70 backdrop-blur p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
                      <div>
                        <div className="text-lg font-bold text-indigo-700 mb-1">座位 {seat?.label || `#${res.seat_id}`}</div>
                        {seat && <div className="text-xs text-slate-500 mb-2">{seat.building} · {seat.zone}</div>}
                        <div className="text-sm text-slate-600 flex items-center gap-1"><Calendar className="w-4 h-4" />{res.res_date}</div>
                      </div>
                      <button onClick={() => handleCancel(res.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg border border-transparent hover:border-red-200 text-sm font-bold transition">取消</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== Student: History ===== */}
        {view === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><History className="w-6 h-6 text-indigo-600" />歷史預約紀錄</h2>
            <p className="text-sm text-slate-500">以下為過去日期或當天已點名的預約，無法取消。</p>
            {myHistory.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">目前沒有歷史紀錄</div>
            ) : (
              <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 overflow-hidden">
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
                        <td className="px-4 py-3 font-bold text-indigo-700">{h.seat_label}</td>
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
        )}

        {/* ===== Student: Reserve Seat ===== */}
        {view === 'reserve' && (
          <div className="space-y-4">
            <div className="bg-white/70 backdrop-blur p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-[180px]">
                <label className="text-sm font-bold text-slate-700">選擇日期</label>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                {isWeekend(selectedDate) && <div className="text-xs text-amber-600 font-medium mt-1">⚠️ 週六日僅開放舊館</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedBuilding('新館')} disabled={isWeekend(selectedDate)} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isWeekend(selectedDate) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : selectedBuilding === '新館' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{isWeekend(selectedDate) ? '新館（週末未開放）' : '新館'}</button>
                <button onClick={() => setSelectedBuilding('舊館')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${selectedBuilding === '舊館' || isWeekend(selectedDate) ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>舊館</button>
              </div>
              <button onClick={() => { fetchSeats(); fetchAvailability(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {renderLegend()}
            <div className="bg-gradient-to-br from-slate-100/50 to-indigo-50/50 rounded-2xl border border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-center">📍 {isWeekend(selectedDate) && selectedBuilding === '新館' ? '舊館' : selectedBuilding}座位圖 — 點擊空位即可預約</h3>
              {isWeekend(selectedDate) && selectedBuilding === '新館' ? renderOldBuilding(false) : (selectedBuilding === '新館' ? renderNewBuilding(false) : renderOldBuilding(false))}
            </div>
          </div>
        )}

        {/* ===== Student: Announcements ===== */}
        {view === 'announcements' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-amber-500" />公告欄</h2>
            {announcements.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-slate-200 text-slate-500">目前沒有公告</div>
            ) : (
              <div className="space-y-4">
                {announcements.map(ann => (
                  <div key={ann.id} className={`bg-white/70 backdrop-blur rounded-2xl border p-6 shadow-sm ${ann.is_pinned ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {ann.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
                      <h3 className="text-lg font-bold text-slate-900">{ann.title}</h3>
                    </div>
                    <div className="text-xs text-slate-500 mb-3">由 {ann.author_name} 發布 · {ann.created_at}{ann.updated_at !== ann.created_at ? ` · 最後更新 ${ann.updated_at}` : ''}</div>
                    <div className="prose-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Admin: Announcement Management ===== */}
        {view === 'admin-announcements' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-amber-600" />公告管理</h2>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}

            {/* Create / Edit form */}
            <div className="bg-white/70 backdrop-blur rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-3">{editingAnn ? `編輯公告 #${editingAnn.id}` : '發布新公告'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-600">標題</label>
                  <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="輸入公告標題" className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">內容（支援 Markdown 語法）</label>
                  <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="支援 **粗體**、*斜體*、# 標題、- 列表、> 引用、[連結](URL) 等語法" rows={6} className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 font-mono text-sm" />
                </div>
                {annContent && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">預覽</label>
                    <div className="mt-1 bg-slate-50 rounded-lg border border-slate-200 p-4 prose-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(annContent) }} />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={annPinned} onChange={e => setAnnPinned(e.target.checked)} className="rounded border-slate-300" />
                  <Pin className="w-3.5 h-3.5 text-amber-500" /> 置頂此公告
                </label>
                <div className="flex gap-2">
                  {editingAnn ? (<>
                    <button onClick={handleUpdateAnnouncement} className="bg-amber-500 hover:bg-amber-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition">更新公告</button>
                    <button onClick={() => { setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition">取消</button>
                  </>) : (
                    <button onClick={handleCreateAnnouncement} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold text-sm transition">發布公告</button>
                  )}
                </div>
              </div>
            </div>

            {/* Existing announcements */}
            {announcements.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-700">已發布的公告</h3>
                {announcements.map(ann => (
                  <div key={ann.id} className={`bg-white/70 backdrop-blur rounded-2xl border p-5 shadow-sm ${ann.is_pinned ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
                          <span className="font-bold text-slate-900">{ann.title}</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-2">{ann.author_name} · {ann.created_at}</div>
                        <div className="prose-sm text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingAnn(ann); setAnnTitle(ann.title); setAnnContent(ann.content); setAnnPinned(ann.is_pinned); }} className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-xs font-bold transition"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 text-xs font-bold transition"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== Modals ===== */}
      {editingSeatNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit3 className="w-5 h-5 text-amber-600" />編輯座位 {editingSeatNote.label} 註記</h3>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="輸入註記（如：靠窗、有插座、冷氣出風口等）" className="w-full border border-slate-200 rounded-lg p-3 text-sm h-24 outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditingSeatNote(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm">取消</button>
              <button onClick={handleSaveSeatNote} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 transition">儲存</button>
            </div>
          </div>
        </div>
      )}

      {showAdminReserve && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" />代為預約座位 {(adminReserveSeatId && seats.find(s => s.id === adminReserveSeatId)?.label) || ''}</h3>
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-slate-600">學號</label><input type="text" value={adminReserveStudentId} onChange={e => setAdminReserveStudentId(e.target.value)} placeholder="輸入學生學號" className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400" /></div>
              <div><label className="text-sm font-medium text-slate-600">日期</label><input type="date" value={adminReserveDate} onChange={e => setAdminReserveDate(e.target.value)} className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400" /></div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdminReserve(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm">取消</button>
              <button onClick={handleAdminReserve} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition">確認預約</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}