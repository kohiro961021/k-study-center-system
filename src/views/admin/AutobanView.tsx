import { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Settings, Play, Search, AlertCircle, Loader2, UserCheck, ChevronLeft, ChevronRight, CheckCircle2, ShieldX, RotateCcw, Calendar, Clock, RefreshCw } from 'lucide-react';
import { useApi } from '../../hooks';
import { StudentUser } from '../../type';

type AutobanRules = {
    enabled: boolean;
    max_absents: number;
    ban_duration_days: number;
    ban_reason: string;
    periodic_reset_enabled?: boolean;
    reset_interval_type?: 'monthly' | 'custom_days';
    reset_day_of_month?: number;
    reset_custom_days?: number;
    last_reset_at?: string | null;
};

type BannedUsersResponse = {
    users: StudentUser[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

const PAGE_SIZE = 20;

export function AutobanView() {
    const apiCall = useApi();

    // Tabs state
    const [activeTab, setActiveTab] = useState<'rules' | 'banned'>('rules');

    // Rules states
    const [rules, setRules] = useState<AutobanRules>({
        enabled: false,
        max_absents: 3,
        ban_duration_days: 1,
        ban_reason: '累計未簽到達系統門檻，暫停預約／使用 K書中心 1 日',
        periodic_reset_enabled: false,
        reset_interval_type: 'monthly',
        reset_day_of_month: 1,
        reset_custom_days: 30,
        last_reset_at: null,
    });
    const [isResettingAll, setIsResettingAll] = useState(false);
    const [isSavingRules, setIsSavingRules] = useState(false);

    // Banned list states
    const [bannedData, setBannedData] = useState<BannedUsersResponse | null>(null);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [isLoadingList, setIsLoadingList] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Scan execution states
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{
        message: string;
        banned: { student_id: string; name: string; reason: string }[];
        unbanned: string[];
    } | null>(null);
    const [showScanModal, setShowScanModal] = useState(false);

    // Fetch Rules
    const fetchRules = useCallback(async () => {
        try {
            const res: AutobanRules = await apiCall('/api/admin/autoban/rules');
            setRules(res);
        } catch (err: any) {
            console.error('Failed to fetch autoban rules:', err);
        }
    }, [apiCall]);

    // Fetch Banned Users
    const fetchBannedUsers = useCallback(async (search: string, currentPage: number) => {
        setIsLoadingList(true);
        try {
            const params = new URLSearchParams({
                search,
                page: String(currentPage),
                page_size: String(PAGE_SIZE),
            });
            const res: BannedUsersResponse = await apiCall(`/api/admin/autoban/banned-users?${params}`);
            setBannedData(res);
        } catch (err: any) {
            console.error('Failed to fetch banned users:', err);
        } finally {
            setIsLoadingList(false);
        }
    }, [apiCall]);

    // Initial Load
    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    useEffect(() => {
        if (activeTab === 'banned') {
            fetchBannedUsers(searchTerm, page);
        }
    }, [activeTab, searchTerm, page, fetchBannedUsers]);

    // Handle Search Debounce
    const handleSearchChange = (value: string) => {
        setInputValue(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(value);
            setPage(1);
        }, 300);
    };

    // Save Rules
    const handleSaveRules = async () => {
        if (rules.max_absents <= 0) {
            alert('累計未到次數門檻必須大於 0');
            return;
        }
        if (rules.periodic_reset_enabled) {
            if (rules.reset_interval_type === 'monthly') {
                const day = rules.reset_day_of_month ?? 1;
                if (day < 1 || day > 28) {
                    alert('每月重置日期請設定在 1 到 28 號之間');
                    return;
                }
            } else if (rules.reset_interval_type === 'custom_days') {
                const days = rules.reset_custom_days ?? 30;
                if (days < 1) {
                    alert('重置間隔天數必須至少為 1 天');
                    return;
                }
            }
        }
        setIsSavingRules(true);
        try {
            await apiCall('/api/admin/autoban/rules', 'PUT', rules);
            alert('暫停權限規則與重置設定已成功更新');
            fetchRules();
        } catch (err: any) {
            alert(`儲存失敗: ${err.message}`);
        } finally {
            setIsSavingRules(false);
        }
    };

    // Reset All Students' Absents
    const handleResetAllAbsents = async () => {
        const confirmMsg = '⚠️ 確定要立即手動將【所有未停權學生】的缺席次數歸零嗎？\n\n說明：\n1. 歷史預約與點名紀錄仍會完整保留。\n2. 所有一般學生的累計缺席次數將從現在起重新計算（歸零）。\n3. 目前正處於停權狀態中的學生將不受影響。';
        if (!window.confirm(confirmMsg)) return;

        setIsResettingAll(true);
        try {
            const res = await apiCall('/api/admin/autoban/reset-all-absents', 'POST');
            alert(res.message || '全體學生缺席額度已成功歸零！');
            fetchRules();
        } catch (err: any) {
            alert(`重置失敗: ${err.message}`);
        } finally {
            setIsResettingAll(false);
        }
    };

    // Run Scan
    const handleRunScan = async () => {
        const confirmMsg = rules.enabled
            ? '⚠️ 確定要立刻執行暫停權限檢測嗎？\n\n系統將掃描曾有預約紀錄的學生，將累計未到次數達門檻者暫停預約／使用權限，並解除已到期者的暫停狀態，且發送 Email 通知。'
            : '⚠️ 目前自動暫停權限功能已關閉，執行檢測只會「解除已到期的暫停狀態」，不會新增學生。確定要執行嗎？';

        if (!window.confirm(confirmMsg)) return;

        setIsScanning(true);
        setScanResult(null);
        setShowScanModal(true);
        try {
            const res = await apiCall('/api/admin/autoban/run', 'POST');
            setScanResult(res);
            // Refresh tables if active
            fetchRules();
            if (activeTab === 'banned') {
                fetchBannedUsers(searchTerm, page);
            }
        } catch (err: any) {
            alert(`執行失敗: ${err.message}`);
            setShowScanModal(false);
        } finally {
            setIsScanning(false);
        }
    };

    // Unban User
    const handleUnbanUser = async (userId: number, studentId: string) => {
        if (!window.confirm(`確定要手動解除學生 ${studentId} 的暫停狀態嗎？`)) return;
        try {
            await apiCall(`/api/admin/users/${userId}/unban`, 'POST');
            alert(`已解除 ${studentId} 的暫停狀態`);
            if (bannedData && bannedData.users.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                fetchBannedUsers(searchTerm, page);
            }
        } catch (err: any) {
            alert(`解除失敗: ${err.message}`);
        }
    };

    const totalPages = bannedData?.total_pages ?? 1;
    const bannedUsers = bannedData?.users ?? [];
    const totalBanned = bannedData?.total ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                        自動暫停權限管理
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">針對累計未到次數達門檻之預約學生，自動暫停預約／使用權限並於到期後恢復。</p>
                </div>

                <button
                    onClick={handleRunScan}
                    disabled={isScanning}
                    className="bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isScanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 fill-current" />
                    )}
                    立即執行檢測
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 rounded-xl max-w-xs">
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`flex-1 py-2 px-3 text-center text-sm font-bold rounded-lg transition ${
                        activeTab === 'rules'
                            ? 'bg-white text-accent shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Settings className="w-4 h-4 inline mr-1.5" />
                    規則設定
                </button>
                <button
                    onClick={() => setActiveTab('banned')}
                    className={`flex-1 py-2 px-3 text-center text-sm font-bold rounded-lg transition ${
                        activeTab === 'banned'
                            ? 'bg-white text-accent shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <ShieldX className="w-4 h-4 inline mr-1.5" />
                    暫停名單 ({rules.enabled ? totalBanned : '查閱'})
                </button>
            </div>

            {/* Rules Tab */}
            {activeTab === 'rules' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Settings Panel */}
                    <div className="lg:col-span-2 bg-card/70 glass-card p-6 rounded-2xl border border-slate-200 space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Settings className="w-5 h-5 text-red-600" />
                            暫停權限規則自訂
                        </h3>

                        {/* Enable/Disable switch */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <span className="block font-bold text-slate-800 text-sm">啟用自動暫停權限系統</span>
                                <span className="block text-xs text-slate-500 mt-0.5">關閉後，系統將不再對未到館學生暫停權限（但每日定時恢復仍會運作）。</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rules.enabled}
                                    onChange={(e) => setRules({ ...rules, enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                            </label>
                        </div>

                        {/* Params */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">累計未到次數門檻</label>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        min={1}
                                        value={rules.max_absents}
                                        onChange={(e) => setRules({ ...rules, max_absents: parseInt(e.target.value) || 0 })}
                                        className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                                        placeholder="例如：3"
                                    />
                                    <span className="absolute right-3 text-sm font-bold text-slate-400">次</span>
                                </div>
                                <span className="block text-xs text-slate-400">曾有預約紀錄的學生，累計「未到」次數達此門檻即觸發暫停權限。</span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">暫停權限時長</label>
                                <div className="relative flex items-center">
                                    <input
                                        type="number"
                                        min={-1}
                                        value={rules.ban_duration_days}
                                        onChange={(e) => setRules({ ...rules, ban_duration_days: parseInt(e.target.value) || 0 })}
                                        className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                                        placeholder="例如：1"
                                    />
                                    <span className="absolute right-3 text-sm font-bold text-slate-400">天</span>
                                </div>
                                <span className="block text-xs text-slate-400">設定暫停天數。輸入 <code className="font-mono bg-slate-100 text-red-600 px-1 py-0.5 rounded text-[11px] font-bold">-1</code> 代表直到管理員手動解除。</span>
                            </div>
                        </div>

                        {/* Default reason */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">系統自動暫停原因註記</label>
                            <input
                                type="text"
                                value={rules.ban_reason}
                                onChange={(e) => setRules({ ...rules, ban_reason: e.target.value })}
                                className="block w-full px-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                                placeholder="請輸入自動暫停原因..."
                            />
                            <span className="block text-xs text-slate-400">此內容將記錄並顯示於學生端。</span>
                        </div>

                        {/* Periodic Absent Reset Section */}
                        <div className="p-5 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 rounded-2xl border border-indigo-100 shadow-xs space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl shrink-0">
                                        <RotateCcw className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="block font-bold text-slate-800 text-sm flex items-center gap-2">
                                            缺席額度週期性重置（自動歸零）
                                            <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">自動排程</span>
                                        </span>
                                        <span className="block text-xs text-slate-500 mt-0.5">
                                            時間到了自動將未達停權門檻的學生缺席次數歸零重新起算（例如：每個月 1 號歸零）。
                                        </span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={rules.periodic_reset_enabled ?? false}
                                        onChange={(e) => setRules({ ...rules, periodic_reset_enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {rules.periodic_reset_enabled && (
                                <div className="space-y-4 pt-3 border-t border-indigo-100/70">
                                    {/* Interval Type Selector */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setRules({ ...rules, reset_interval_type: 'monthly' })}
                                            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                                                (rules.reset_interval_type ?? 'monthly') === 'monthly'
                                                    ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                                                    : 'bg-white/60 border-slate-200 hover:bg-white'
                                            }`}
                                        >
                                            <Calendar className={`w-5 h-5 mt-0.5 ${(rules.reset_interval_type ?? 'monthly') === 'monthly' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">每月固定日重置</div>
                                                <div className="text-xs text-slate-500 mt-0.5">每個月的指定日期（凌晨 00:01）自動歸零</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setRules({ ...rules, reset_interval_type: 'custom_days' })}
                                            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                                                rules.reset_interval_type === 'custom_days'
                                                    ? 'bg-white border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                                                    : 'bg-white/60 border-slate-200 hover:bg-white'
                                            }`}
                                        >
                                            <Clock className={`w-5 h-5 mt-0.5 ${rules.reset_interval_type === 'custom_days' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">固定間隔天數重置</div>
                                                <div className="text-xs text-slate-500 mt-0.5">每隔固定天數（例如每 30 天）自動歸零</div>
                                            </div>
                                        </button>
                                    </div>

                                    {/* Interval Parameters */}
                                    {(rules.reset_interval_type ?? 'monthly') === 'monthly' ? (
                                        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block">每月重置日期</label>
                                                <span className="text-[11px] text-slate-400">每個月的這一天凌晨將自動歸零全體學生缺席紀錄（可設 1 ~ 28 號）</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500">每月</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={28}
                                                    value={rules.reset_day_of_month ?? 1}
                                                    onChange={(e) => setRules({ ...rules, reset_day_of_month: Math.max(1, Math.min(28, parseInt(e.target.value) || 1)) })}
                                                    className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                                                />
                                                <span className="text-xs font-bold text-slate-500">日</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-700 block">重置週期天數</label>
                                                <span className="text-[11px] text-slate-400">自上次歸零起，經過此天數後自動再次執行全體歸零</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500">每隔</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={rules.reset_custom_days ?? 30}
                                                    onChange={(e) => setRules({ ...rules, reset_custom_days: Math.max(1, parseInt(e.target.value) || 1) })}
                                                    className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                                                />
                                                <span className="text-xs font-bold text-slate-500">天</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reset info & Manual reset action */}
                            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100/60">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className={`inline-block w-2 h-2 rounded-full ${rules.periodic_reset_enabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                    <span>上次歸零時間：</span>
                                    <strong className="text-slate-700 font-mono">
                                        {rules.last_reset_at
                                            ? new Date(rules.last_reset_at).toLocaleString('zh-TW', { hour12: false })
                                            : '尚未執行過'}
                                    </strong>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleResetAllAbsents}
                                    disabled={isResettingAll}
                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                                    title="立即手動將所有未停權學生的缺席次數歸零重新計算"
                                >
                                    {isResettingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                    立即手動歸零所有學生額度
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4 flex justify-end">
                            <button
                                onClick={handleSaveRules}
                                disabled={isSavingRules}
                                className="bg-accent hover:bg-accent-hover text-white font-bold px-6 py-2.5 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 text-sm"
                            >
                                {isSavingRules && <Loader2 className="w-4 h-4 animate-spin" />}
                                儲存規則設定
                            </button>
                        </div>
                    </div>

                    {/* Right: Info Cards */}
                    <div className="space-y-6">
                        <div className="bg-card/70 glass-card border border-slate-200 p-6 rounded-2xl space-y-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                運作機制說明
                            </h4>
                            <ul className="space-y-2 text-xs text-slate-500 leading-relaxed list-decimal pl-4">
                                <li>
                                    <strong>每日定時排程：</strong>系統每天晚上 <b>22:05</b> 會自動跑一次暫停權限檢測。
                                </li>
                                <li>
                                    <strong>僅針對曾預約學生：</strong>從未預約過座位的學生不會被列入檢測範圍，避免誤鎖從未使用過系統的帳號。
                                </li>
                                <li>
                                    <strong>累計未到次數觸發：</strong>曾有預約紀錄的學生，只要累計「未到」次數達到設定門檻，即會被自動暫停預約／使用權限。
                                </li>
                                <li>
                                    <strong>暫停後歸零重算：</strong>一旦被自動暫停權限，未到次數會歸零；恢復後需重新累積達到門檻才會再次觸發。
                                </li>
                                <li>
                                    <strong>到期自動恢復：</strong>每日排程或學生點選「預約座位」時，後端會自動比對暫停截止時間。一旦過期，將自動解除暫停狀態。
                                </li>
                                <li>
                                    <strong>Email 即時通知：</strong>無論是系統自動暫停、手動暫停或手動解除，系統皆會發信通知有填寫信箱的學生。
                                </li>
                                <li>
                                    <strong>缺席額度定期歸零：</strong>啟用後，若學生在週期內未滿懲處門檻（如一個月只缺席兩次），到期後缺席次數自動歸零重新累積；歷史預約與點名清單均完整保留。
                                </li>
                                <li>
                                    <strong>安全獨立機制：</strong>缺席歸零僅重置未被懲處的學生，目前正處於暫停權限中的學生不會被提前解除，保障紀律有效性。
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Banned Users Tab */}
            {activeTab === 'banned' && (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Search bar */}
                    <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="搜尋暫停中學生學號或姓名..."
                            className="flex-1 outline-none text-sm bg-transparent"
                        />
                        {isLoadingList && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
                        {totalBanned > 0 && !isLoadingList && (
                            <span className="text-xs text-slate-400 shrink-0">共 {totalBanned} 筆暫停中</span>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold text-slate-700">學號</th>
                                    <th className="px-4 py-3 text-left font-bold text-slate-700">姓名</th>
                                    <th className="px-4 py-3 text-left font-bold text-slate-700">暫停原因</th>
                                    <th className="px-4 py-3 text-left font-bold text-slate-700">預計恢復時間</th>
                                    <th className="px-4 py-3 text-right font-bold text-slate-700">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingList && bannedUsers.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                                            <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                                            <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-48" /></td>
                                            <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-32" /></td>
                                            <td className="px-4 py-3 text-right"><div className="h-6 bg-slate-100 rounded animate-pulse w-20 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : bannedUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                                            {searchTerm ? `找不到「${searchTerm}」的暫停中學生` : '目前無任何學生暫停中'}
                                        </td>
                                    </tr>
                                ) : (
                                    bannedUsers.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-4 py-3 text-red-600 font-bold font-mono">{u.student_id}</td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">{u.name || '未填寫'}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title={u.ban_reason || ''}>
                                                {u.ban_reason || '無註記原因'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-medium text-xs">
                                                {u.banned_until ? (
                                                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 inline-block font-mono">
                                                        {u.banned_until}
                                                    </span>
                                                ) : (
                                                    <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 inline-block">
                                                        手動解除
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleUnbanUser(u.id, u.student_id)}
                                                    className="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-bold transition inline-flex items-center gap-1"
                                                >
                                                    <UserCheck className="w-3.5 h-3.5" />
                                                    解除暫停
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page <= 1 || isLoadingList}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                上一頁
                            </button>

                            <span className="text-xs font-bold text-slate-500">
                                頁碼：{page} / {totalPages}
                            </span>

                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page >= totalPages || isLoadingList}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                                下一頁
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Scan Modal */}
            {showScanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
                        <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 shrink-0">
                            <ShieldAlert className="w-6 h-6 text-red-600" />
                            <h3 className="text-lg font-bold text-slate-900">暫停權限檢測程序執行中</h3>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto py-6 space-y-4">
                            {isScanning ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
                                    <span className="text-sm font-bold text-slate-600">正在掃描資料庫、評估出席率與發送通知...</span>
                                </div>
                            ) : scanResult ? (
                                <div className="space-y-4">
                                    {/* Success Header */}
                                    <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-sm font-bold">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                        {scanResult.message}
                                    </div>

                                    {/* Banned details */}
                                    <div className="space-y-2">
                                        <span className="block font-bold text-slate-700 text-sm">
                                            新增暫停名單 ({scanResult.banned.length} 人)
                                        </span>
                                        {scanResult.banned.length === 0 ? (
                                            <span className="block text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">無新增暫停學生</span>
                                        ) : (
                                            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                                                {scanResult.banned.map((b, idx) => (
                                                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-700">{b.student_id} ({b.name})</span>
                                                        <span className="text-red-600 font-bold bg-red-50 border border-red-100 px-1.5 py-0.5 rounded scale-90">{b.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Unbanned details */}
                                    <div className="space-y-2">
                                        <span className="block font-bold text-slate-700 text-sm">
                                            自動復權名單 ({scanResult.unbanned.length} 人)
                                        </span>
                                        {scanResult.unbanned.length === 0 ? (
                                            <span className="block text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">無解除暫停學生</span>
                                        ) : (
                                            <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50 p-2 text-xs flex flex-wrap gap-1.5">
                                                {scanResult.unbanned.map((sid, idx) => (
                                                    <span key={idx} className="bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded border border-emerald-100">
                                                        {sid}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                onClick={() => setShowScanModal(false)}
                                disabled={isScanning}
                                className="bg-accent hover:bg-accent-hover text-white font-bold px-5 py-2 rounded-xl transition text-sm disabled:opacity-50"
                            >
                                關閉視窗
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
