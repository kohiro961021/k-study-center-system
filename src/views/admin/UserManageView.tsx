import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Key, KeyRound, Search, AlertCircle, ChevronLeft, ChevronRight, Loader2, ShieldAlert, ShieldX } from 'lucide-react';
import { useApi } from '../../hooks';

import { UserPage } from '../../type';

const PAGE_SIZE = 20;

export function UserManageView() {
    const apiCall = useApi();


    const [data, setData] = useState<UserPage | null>(null);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [adminOldPw, setAdminOldPw] = useState('');
    const [adminNewPw, setAdminNewPw] = useState('');
    const [adminConfirmPw, setAdminConfirmPw] = useState('');

    const [resetStudentId, setResetStudentId] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');

    const fetchUsers = useCallback(async (search: string, currentPage: number) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                search,
                page: String(currentPage),
                page_size: String(PAGE_SIZE),
            });
            const result: UserPage = await apiCall(`/api/admin/users?${params}`);
            setData(result);
        } catch {
            // error handled by useApi
        } finally {
            setIsLoading(false);
        }
    }, [apiCall]);

    // Initial load
    useEffect(() => {
        fetchUsers('', 1);
    }, [fetchUsers]);

    // Debounce search input → reset to page 1
    const handleSearchChange = (value: string) => {
        setInputValue(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(value);
            setPage(1);
            fetchUsers(value, 1);
        }, 300);
    };

    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchUsers(searchTerm, newPage);
    };

    const handleResetPassword = async (sid?: string) => {
        const targetId = sid || resetStudentId;
        if (!targetId) { alert('請輸入學號'); return; }

        let newPw = sid ? '' : resetNewPassword;
        if (sid) { const input = window.prompt(`請輸入 ${sid} 的新密碼：`); if (!input) return; newPw = input; }
        if (!newPw) { alert('請輸入新密碼'); return; }

        try {
            const result = await apiCall('/api/admin/reset-password', 'PUT', { student_id: targetId, new_password: newPw });
            alert(result.message);
            setResetStudentId('');
            setResetNewPassword('');
        } catch (err: any) { alert(`重設失敗: ${err.message}`); }
    };

    const handleBanUser = async (user: StudentUser) => {
        const reason = window.prompt(`請輸入對學生 ${user.student_id} 的停權原因：`, '違反使用規範');
        if (reason === null) return;
        const durationStr = window.prompt(`請輸入停權天數（輸入大於 0 的整數，或輸入 -1 代表永久停權）：`, '7');
        if (durationStr === null) return;
        const duration = parseInt(durationStr);
        if (isNaN(duration) || (duration <= 0 && duration !== -1)) {
            alert('天數格式錯誤！');
            return;
        }

        try {
            const result = await apiCall(`/api/admin/users/${user.id}/ban`, 'POST', {
                duration_days: duration,
                reason: reason.trim()
            });
            alert(result.message);
            fetchUsers(searchTerm, page);
        } catch (err: any) {
            alert(`停權失敗: ${err.message}`);
        }
    };

    const handleUnbanUser = async (user: StudentUser) => {
        if (!window.confirm(`確定要解除學生 ${user.student_id} 的停權狀態嗎？`)) return;
        try {
            const result = await apiCall(`/api/admin/users/${user.id}/unban`, 'POST');
            alert(result.message);
            fetchUsers(searchTerm, page);
        } catch (err: any) {
            alert(`解除停權失敗: ${err.message}`);
        }
    };

    const handleAdminChangePassword = async () => {
        if (!adminOldPw) { alert('請輸入舊密碼'); return; }
        if (!adminNewPw) { alert('請輸入新密碼'); return; }
        if (!adminConfirmPw) { alert('請再次輸入新密碼確認'); return; }
        if (adminNewPw !== adminConfirmPw) { alert('兩次輸入的新密碼不一致'); return; }
        if (!window.confirm('⚠️ 確定要修改管理員密碼嗎？\n\n修改後需要使用新密碼重新登入。')) return;
        try {
            const result = await apiCall('/api/admin/change-password', 'PUT', { old_password: adminOldPw, new_password: adminNewPw, confirm_password: adminConfirmPw });
            alert(result.message);
            setAdminOldPw(''); setAdminNewPw(''); setAdminConfirmPw('');
        } catch (err: any) { alert(`修改失敗: ${err.message}`); }
    };

    const totalPages = data?.total_pages ?? 1;
    const users = data?.users ?? [];
    const total = data?.total ?? 0;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" />帳號管理</h2>

            {/* User list with search */}
            <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                {/* Search bar */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => handleSearchChange(e.target.value)}
                        placeholder="搜尋學號或姓名..."
                        className="flex-1 outline-none text-sm bg-transparent"
                    />
                    {isLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
                    {total > 0 && !isLoading && (
                        <span className="text-xs text-slate-400 shrink-0">共 {total} 筆</span>
                    )}
                </div>

                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                            <th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th>
                            <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading && users.length === 0 ? (
                            // Loading skeleton
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                                    <td className="px-4 py-3 text-right"><div className="h-6 bg-slate-100 rounded animate-pulse w-20 ml-auto" /></td>
                                </tr>
                            ))
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">
                                    {searchTerm ? `找不到「${searchTerm}」的相關用戶` : '尚無用戶資料'}
                                </td>
                            </tr>
                        ) : (
                            users.map(u => (
                                <tr key={u.id} className={`hover:bg-slate-50 transition ${u.is_banned ? 'bg-red-50/20' : ''}`}>
                                    <td className="px-4 py-3 text-accent font-medium">
                                        <div className="flex items-center gap-1.5">
                                            {u.student_id}
                                            {u.is_banned && (
                                                <span className="bg-red-100 text-red-700 font-bold text-[10px] px-1.5 py-0.5 rounded border border-red-200" title={u.ban_reason || ''}>
                                                    已停權
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{u.name || '未填寫'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleResetPassword(u.student_id)} className="text-amber-600 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs font-bold transition flex items-center gap-1">
                                                <Key className="w-3 h-3" />重設密碼
                                            </button>
                                            {u.is_banned ? (
                                                <button onClick={() => handleUnbanUser(u)} className="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-bold transition flex items-center gap-1">
                                                    <ShieldX className="w-3.5 h-3.5" />解除停權
                                                </button>
                                            ) : (
                                                <button onClick={() => handleBanUser(u)} className="text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 text-xs font-bold transition flex items-center gap-1">
                                                    <ShieldAlert className="w-3.5 h-3.5" />停權
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1 || isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            <ChevronLeft className="w-4 h-4" />上一頁
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, idx) =>
                                    p === 'ellipsis' ? (
                                        <span key={`e-${idx}`} className="px-1 text-slate-400 text-sm">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => handlePageChange(p as number)}
                                            disabled={isLoading}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition ${page === p ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )
                            }
                        </div>

                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page >= totalPages || isLoading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            下一頁<ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Admin change own password */}
            <div className="bg-card/70 glass-card p-6 rounded-2xl border border-slate-200 shadow-sm">
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

                    <button onClick={handleAdminChangePassword} className="bg-accent hover:bg-accent-hover text-[#fff] font-bold px-6 py-2 rounded-lg transition flex items-center gap-1"><KeyRound className="w-4 h-4" />修改密碼</button>
                </div>

                {adminNewPw && adminConfirmPw && adminNewPw !== adminConfirmPw && (
                    <div className="mt-2 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />兩次輸入的新密碼不一致</div>
                )}
            </div>

        </div>
    );
}
