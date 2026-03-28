import { useState, useEffect } from 'react';
import { Shield, Calendar, Clock, LogOut, User, Lock, Mail, AlertCircle, RefreshCw, Users, Key, Trash2, Search } from 'lucide-react';

// 👉 修正 1：因為 vite.config.ts 已經設定了 Proxy，所以這裡留空，讓 Vite 幫我們轉發！
const API_BASE = '';
// 👉 修正 2：補上 Nginx 需要的通關密語
const KLIB_KEY = 'test';

type View = 'login' | 'register' | 'dashboard' | 'reserve' | 'admin-reservations' | 'admin-users';
type Seat = { id: number; label: string; x: number; y: number; status: string };
type Reservation = { id: number; seat_id: number; res_date: string; timeslot: string; user_id: number };
type AdminReservation = Reservation & { student_id: string; seat_label: string };
type StudentUser = { id: number; student_id: string; is_admin: boolean };

// 簡單解碼 JWT payload（不驗證簽名，僅用於前端顯示）
function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function App() {
  const [view, setView] = useState<View>('login');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAdmin, setIsAdmin] = useState(false);
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

  // Admin 狀態
  const [allReservations, setAllReservations] = useState<AdminReservation[]>([]);
  const [allUsers, setAllUsers] = useState<StudentUser[]>([]);
  const [resetStudentId, setResetStudentId] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(res.ok ? text : `伺服器錯誤 (${res.status})`);
      }
      if (!res.ok) throw new Error(data.detail || '請求失敗');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token);
      const admin = payload?.admin === true;
      setIsAdmin(admin);
      setView(admin ? 'admin-reservations' : 'dashboard');
      fetchSeats();
      if (!admin) fetchMyReservations();
    }
  }, [token]);

  useEffect(() => {
    if (view === 'reserve') {
      fetchSeats();
      fetchAvailability();
    }
    if (view === 'admin-reservations') fetchAdminReservations();
    if (view === 'admin-users') fetchAdminUsers();
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

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`伺服器錯誤 (${res.status})`);
      }
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
    setIsAdmin(false);
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

  // --- Admin Functions ---
  const fetchAdminReservations = async () => {
    try {
      const data = await apiCall('/api/admin/reservations');
      setAllReservations(data);
    } catch (err) { }
  };

  const fetchAdminUsers = async () => {
    try {
      const data = await apiCall('/api/admin/users');
      setAllUsers(data);
    } catch (err) { }
  };

  const handleAdminCancelReservation = async (resId: number) => {
    if (!window.confirm('確定要取消這個學生的預約嗎？')) return;
    try {
      await apiCall(`/api/admin/reservations/${resId}`, 'DELETE');
      setAdminMessage('已成功取消預約');
      fetchAdminReservations();
    } catch (err: any) {
      setAdminMessage(`取消失敗: ${err.message}`);
    }
  };

  const handleResetPassword = async (sid?: string) => {
    const targetId = sid || resetStudentId;
    const targetPw = sid ? '' : resetNewPassword;

    if (!targetId) { setAdminMessage('請輸入學號'); return; }

    // 如果從用戶列表點擊，用 prompt 取得新密碼
    let newPw = targetPw;
    if (sid) {
      const input = window.prompt(`請輸入 ${sid} 的新密碼：`);
      if (!input) return;
      newPw = input;
    }
    if (!newPw) { setAdminMessage('請輸入新密碼'); return; }

    try {
      const result = await apiCall('/api/admin/reset-password', 'PUT', { student_id: targetId, new_password: newPw });
      setAdminMessage(result.message);
      setResetStudentId('');
      setResetNewPassword('');
    } catch (err: any) {
      setAdminMessage(`重設失敗: ${err.message}`);
    }
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
            K書中心{isAdmin ? '管理後台' : '預約系統'}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <button onClick={() => setView('admin-reservations')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'admin-reservations' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />預約管理</span>
                </button>
                <button onClick={() => setView('admin-users')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'admin-users' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-1"><Users className="w-4 h-4" />學生管理</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'dashboard' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>我的預約</button>
                <button onClick={() => setView('reserve')} className={`px-4 py-2 rounded-lg font-medium text-sm transition ${view === 'reserve' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>預約座位</button>
              </>
            )}
            <button onClick={handleLogout} className="ml-2 text-red-600 hover:bg-red-50 p-2 rounded-lg transition"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* ===== 管理員：預約管理 ===== */}
        {view === 'admin-reservations' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-7 h-7 text-amber-600" />
                全部預約紀錄
              </h2>
              <button onClick={fetchAdminReservations} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition">
                <RefreshCw className="w-4 h-4" /> 重新整理
              </button>
            </div>

            {adminMessage && (
              <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between">
                <span>{adminMessage}</span>
                <button onClick={() => setAdminMessage(null)} className="text-amber-600 hover:text-amber-800 font-bold">✕</button>
              </div>
            )}

            {allReservations.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">目前沒有任何預約紀錄</div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">座位</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">日期</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">時段</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allReservations.map(res => (
                      <tr key={res.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-indigo-700">{res.student_id}</td>
                        <td className="px-4 py-3 font-bold">{res.seat_label}</td>
                        <td className="px-4 py-3 text-slate-600">{res.res_date}</td>
                        <td className="px-4 py-3 text-slate-600">{res.timeslot}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleAdminCancelReservation(res.id)} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg border border-red-200 hover:border-red-300 text-xs font-bold transition flex items-center gap-1 ml-auto">
                            <Trash2 className="w-3 h-3" /> 取消預約
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ===== 管理員：學生管理 ===== */}
        {view === 'admin-users' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-amber-600" />
              學生帳號管理
            </h2>

            {adminMessage && (
              <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between">
                <span>{adminMessage}</span>
                <button onClick={() => setAdminMessage(null)} className="text-amber-600 hover:text-amber-800 font-bold">✕</button>
              </div>
            )}

            {/* 重設密碼表單 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-amber-600" /> 重設學生密碼</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <label className="text-sm font-medium text-slate-600">學號</label>
                  <input type="text" value={resetStudentId} onChange={(e) => setResetStudentId(e.target.value)} placeholder="輸入學號" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
                <div className="flex-1 min-w-[180px] space-y-1">
                  <label className="text-sm font-medium text-slate-600">新密碼</label>
                  <input type="text" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} placeholder="輸入新密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" />
                </div>
                <button onClick={() => handleResetPassword()} className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-2 rounded-lg transition flex items-center gap-2">
                  <Key className="w-4 h-4" /> 重設密碼
                </button>
              </div>
            </div>

            {/* 學生列表 */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="搜尋學號..." className="flex-1 outline-none text-sm" />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUsers
                    .filter(u => u.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-indigo-700">{u.student_id}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleResetPassword(u.student_id)} className="text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 hover:border-amber-300 text-xs font-bold transition flex items-center gap-1 ml-auto">
                            <Key className="w-3 h-3" /> 重設密碼
                          </button>
                        </td>
                      </tr>
                    ))}
                  {allUsers.filter(u => u.student_id.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400">沒有找到符合的學生</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== 學生：我的預約面板 ===== */}
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

        {/* ===== 學生：預約座位面板 ===== */}
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
                  <option value="09:00-12:00">假日上午 (09:00-12:00)</option>
                  <option value="13:00-17:00">假日下午 (13:00-17:00)</option>
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