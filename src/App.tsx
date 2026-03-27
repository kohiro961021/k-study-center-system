import { useState, useEffect } from 'react';
import { Shield, Calendar, Clock, LogOut, User, Lock, Mail, AlertCircle, RefreshCw } from 'lucide-react';

// 👉 修正 1：因為 vite.config.ts 已經設定了 Proxy，所以這裡留空，讓 Vite 幫我們轉發！
const API_BASE = '';
// 👉 修正 2：補上 Nginx 需要的通關密語
const KLIB_KEY = 'test';

type View = 'login' | 'register' | 'dashboard' | 'reserve';
type Seat = { id: number; label: string; x: number; y: number; status: string };
type Reservation = { id: number; seat_id: number; res_date: string; timeslot: string; user_id: number };

export default function App() {
  const [view, setView] = useState<View>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 狀態
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('17:00-21:00');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [bookedSeatIds, setBookedSeatIds] = useState<number[]>([]);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);

  // 統一的 API 呼叫函式
  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    const headers: any = {
      'Content-Type': 'application/json',
      'X-KLib-Key': KLIB_KEY,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '請求失敗');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    if (token) {
      setView('dashboard');
      fetchMyReservations();
    }
  }, [token]);

  useEffect(() => {
    if (view === 'reserve') {
      fetchSeats();
      fetchAvailability();
    }
  }, [view, selectedDate, selectedSlot]);

  // 登入
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // OAuth2 規定要用表單格式
      const formData = new URLSearchParams();
      formData.append('username', studentId);
      formData.append('password', password);

      const res = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-KLib-Key': KLIB_KEY
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setStudentId('');
    setPassword('');
    setView('login');
  };

  const fetchSeats = async () => {
    try {
      const data = await apiCall('/api/seats');
      setSeats(data);
    } catch (err) { }
  };

  const fetchAvailability = async () => {
    try {
      const data = await apiCall(`/api/availability?res_date=${selectedDate}&timeslot=${selectedSlot}`);
      setBookedSeatIds(data);
    } catch (err) { }
  };

  const fetchMyReservations = async () => {
    try {
      const data = await apiCall('/api/my-reservations');
      setMyReservations(data);
    } catch (err) { }
  };

  const handleReserve = async (seatId: number) => {
    if (!window.confirm('確定要預約這個座位嗎？')) return;
    setLoading(true);
    try {
      await apiCall('/api/reserve', 'POST', { seat_id: seatId, res_date: selectedDate, timeslot: selectedSlot });
      alert('預約成功！');
      fetchAvailability();
      fetchMyReservations();
    } catch (err: any) {
      alert(`預約失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (resId: number) => {
    if (!window.confirm('確定要取消這個預約嗎？')) return;
    try {
      await apiCall(`/api/reservations/${resId}`, 'DELETE');
      fetchMyReservations();
    } catch (err) { }
  };

  // 畫面渲染 - 登入頁面
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="flex items-center gap-2 mb-8">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">鳳山高中 K書中心</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">學號</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} required placeholder="輸入學號 (如: student001)" className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">密碼</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="輸入密碼 (如: pass123)" className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 transition">
              {loading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 畫面渲染 - 登入後的系統
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-lg">
            <Shield className="w-6 h-6 text-indigo-600" />
            K書中心預約系統
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>我的預約</button>
            <button onClick={() => setView('reserve')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'reserve' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>預約座位</button>
            <button onClick={handleLogout} className="ml-2 text-red-600 hover:bg-red-50 p-2 rounded-lg transition"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 我的預約面板 */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">我的預約紀錄</h2>
            {myReservations.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">目前沒有預約，快去搶位子吧！</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myReservations.map(res => (
                  <div key={res.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
                    <div>
                      <div className="text-lg font-bold text-indigo-700 mb-2">座位號碼：{seats.find(s => s.id === res.seat_id)?.label || `#${res.seat_id}`}</div>
                      <div className="text-sm text-slate-600 flex items-center gap-2 mb-1"><Calendar className="w-4 h-4" /> 日期：{res.res_date}</div>
                      <div className="text-sm text-slate-600 flex items-center gap-2"><Clock className="w-4 h-4" /> 時段：{res.timeslot}</div>
                    </div>
                    <button onClick={() => handleCancel(res.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-200 text-sm font-bold">
                      取消預約
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 預約座位面板 */}
        {view === 'reserve' && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <label className="text-sm font-bold text-slate-700">選擇日期</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-2 flex-1 min-w-[200px]">
                <label className="text-sm font-bold text-slate-700">選擇時段</label>
                <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="17:00-21:00">平日晚間 (17:00-21:00)</option>
                  <option value="09:00-17:00">假日全天 (09:00-17:00)</option>
                </select>
              </div>
              <button onClick={() => { fetchSeats(); fetchAvailability(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition">
                <RefreshCw className="w-4 h-4" /> 重新整理座位
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 border-b pb-4">📍 點擊選擇座位</h3>
              <div className="grid grid-cols-5 gap-4 max-w-2xl mx-auto">
                {seats.map(seat => {
                  const isBooked = bookedSeatIds.includes(seat.id);
                  return (
                    <button
                      key={seat.id}
                      disabled={isBooked || seat.status === 'maintenance'}
                      onClick={() => handleReserve(seat.id)}
                      className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-lg transition-all border-2
                        ${isBooked || seat.status === 'maintenance'
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:-translate-y-1'}
                      `}
                    >
                      {seat.label}
                      <span className="text-xs font-normal mt-1 opacity-80">
                        {isBooked ? '已預約' : (seat.status === 'maintenance' ? '維修中' : '空位')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}