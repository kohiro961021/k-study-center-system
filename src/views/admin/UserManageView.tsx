import { useState, useEffect } from 'react';
import { Users, Key, KeyRound, Search, AlertCircle } from 'lucide-react';
import { useApi } from '../../hooks';
import { useUI } from '../../context';
import { StudentUser } from '../../type';

export function UserManageView() {
    const apiCall = useApi();
    const { setAdminMessage } = useUI();
    
    const [allUsers, setAllUsers] = useState<StudentUser[]>([]);
    const [resetStudentId, setResetStudentId] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [adminOldPw, setAdminOldPw] = useState('');
    const [adminNewPw, setAdminNewPw] = useState('');
    const [adminConfirmPw, setAdminConfirmPw] = useState('');

    const fetchAdminUsers = async () => { try { setAllUsers(await apiCall('/api/admin/users')); } catch { } };

    useEffect(() => {
        fetchAdminUsers();
    }, []);

    const handleResetPassword = async (sid?: string) => {
        const targetId = sid || resetStudentId;
        if (!targetId) { setAdminMessage('請輸入學號'); return; }

        let newPw = sid ? '' : resetNewPassword;
        if (sid) { const input = window.prompt(`請輸入 ${sid} 的新密碼：`); if (!input) return; newPw = input; }
        if (!newPw) { setAdminMessage('請輸入新密碼'); return; }

        try { 
            const result = await apiCall('/api/admin/reset-password', 'PUT', { student_id: targetId, new_password: newPw }); 
            setAdminMessage(result.message);
            setResetStudentId('');
            setResetNewPassword(''); 
        } catch (err: any) { setAdminMessage(`重設失敗: ${err.message}`); }
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

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-amber-600" />學生帳號管理</h2>

            {/* Reset student password form */}
            <div className="bg-card/70 glass-card p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-amber-600" /> 重設學生密碼</h3>

                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px] space-y-1">
                        <label className="text-sm font-medium text-slate-600">學號</label>
                        <input type="text" value={resetStudentId} onChange={e => setResetStudentId(e.target.value)} placeholder="輸入學號" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                    <div className="flex-1 min-w-[180px] space-y-1">
                        <label className="text-sm font-medium text-slate-600">新密碼</label>
                        <input type="text" value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} placeholder="輸入新密碼" className="block w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none" />
                    </div>
                    <button onClick={() => handleResetPassword()} className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-2 rounded-lg transition"><Key className="w-4 h-4 inline mr-1" />重設</button>
                </div>
            </div>

            {/* User list with search */}
            <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center gap-3"><Search className="w-4 h-4 text-slate-400" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="搜尋學號..." className="flex-1 outline-none text-sm bg-transparent" />
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
                        {allUsers.filter(u => u.student_id.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 text-accent font-medium">{u.student_id}</td>
                            <td className="px-4 py-3 text-slate-600">{u.name || '未填寫'}</td>
                            <td className="px-4 py-3 text-right"><button onClick={() => handleResetPassword(u.student_id)} className="text-amber-600 hover:bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 text-xs font-bold transition"><Key className="w-3 h-3 inline mr-1" />重設密碼</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
