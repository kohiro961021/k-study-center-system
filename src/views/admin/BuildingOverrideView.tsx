import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { useApi } from '../../hooks';

type Override = { date: string; building: string; status: string };
type BuildingChoice = '新館' | '舊館' | '全部';
type StatusChoice = 'open' | 'closed' | 'auto';

const getTodayStr = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const tz8 = new Date(utc + 8 * 3600000);
    return `${tz8.getUTCFullYear()}-${String(tz8.getUTCMonth() + 1).padStart(2, '0')}-${String(tz8.getUTCDate()).padStart(2, '0')}`;
};

const getDatesInRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(start + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (cur <= last) {
        dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
};

const STATUS_DISPLAY: Record<string, { label: string; badge: string }> = {
    open:   { label: '強制開放', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    closed: { label: '強制關閉', badge: 'bg-red-100 text-red-700 border-red-300' },
    auto:   { label: '自動',     badge: 'bg-slate-100 text-slate-500 border-slate-300' },
};

const TodayBuildingPanel = ({
    building,
    currentStatus,
    onSet,
}: {
    building: string;
    currentStatus: string;
    onSet: (status: StatusChoice) => void;
}) => {
    const { label, badge } = STATUS_DISPLAY[currentStatus] ?? STATUS_DISPLAY.auto;

    return (
        <div className="flex flex-col gap-2 p-4 bg-card rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{building}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{label}</span>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => onSet('auto')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all ${currentStatus === 'auto' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                >
                    自動
                </button>
                <button
                    onClick={() => onSet('open')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all ${currentStatus === 'open' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                >
                    強制開放
                </button>
                <button
                    onClick={() => onSet('closed')}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all ${currentStatus === 'closed' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                >
                    強制關閉
                </button>
            </div>
        </div>
    );
};

export function BuildingOverrideView() {
    const apiCall = useApi();
    const today = getTodayStr();

    const [overrides, setOverrides] = useState<Override[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const [formStart, setFormStart] = useState(today);
    const [formEnd, setFormEnd] = useState(today);
    const [formBuilding, setFormBuilding] = useState<BuildingChoice>('全部');
    const [formStatus, setFormStatus] = useState<StatusChoice>('closed');

    const fetchOverrides = useCallback(async () => {
        try { setOverrides(await apiCall('/api/settings/building/overrides')); } catch { }
    }, [apiCall]);

    useEffect(() => { fetchOverrides(); }, []);

    const getStatus = (date: string, building: string) =>
        overrides.find(o => o.date === date && o.building === building)?.status ?? 'auto';

    const setOverride = async (date: string, building: string, status: StatusChoice) => {
        try {
            await apiCall(`/api/admin/settings/building/overrides/${date}`, 'PUT', { building, status });
            fetchOverrides();
        } catch { }
    };

    const handleAddRule = async () => {
        if (formStart > formEnd) { alert('起始日期不能晚於結束日期'); return; }
        const dates = getDatesInRange(formStart, formEnd);
        const buildings = formBuilding === '全部' ? ['新館', '舊館'] : [formBuilding];
        setSubmitting(true);
        try {
            for (const date of dates) {
                for (const b of buildings) {
                    await apiCall(`/api/admin/settings/building/overrides/${date}`, 'PUT', { building: b, status: formStatus }, false);
                }
            }
            await fetchOverrides();
            alert(`已更新 ${dates.length} 天 × ${buildings.length} 館，共 ${dates.length * buildings.length} 筆`);
        } catch (err: any) {
            alert(`部分更新失敗：${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (date: string, building: string) => {
        try {
            await apiCall(`/api/admin/settings/building/overrides/${date}`, 'PUT', { building, status: 'auto' });
            fetchOverrides();
        } catch { }
    };

    const activeOverrides = overrides
        .filter(o => o.status !== 'auto')
        .sort((a, b) => a.date.localeCompare(b.date) || a.building.localeCompare(b.building));

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-indigo-600" />
                館別開放狀態管理
            </h2>

            {/* 今日快速調整 */}
            <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">今日快速調整 — {today}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TodayBuildingPanel
                        building="新館"
                        currentStatus={getStatus(today, '新館')}
                        onSet={s => setOverride(today, '新館', s)}
                    />
                    <TodayBuildingPanel
                        building="舊館"
                        currentStatus={getStatus(today, '舊館')}
                        onSet={s => setOverride(today, '舊館', s)}
                    />
                </div>
            </div>

            {/* 新增規則 */}
            <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    新增規則
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">起始日期</label>
                        <input
                            type="date"
                            value={formStart}
                            onChange={e => setFormStart(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-card"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">結束日期</label>
                        <input
                            type="date"
                            value={formEnd}
                            min={formStart}
                            onChange={e => setFormEnd(e.target.value)}
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-card"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">館別</label>
                        <select
                            value={formBuilding}
                            onChange={e => setFormBuilding(e.target.value as BuildingChoice)}
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-card"
                        >
                            <option value="全部">全部（新館＋舊館）</option>
                            <option value="新館">新館</option>
                            <option value="舊館">舊館</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">狀態</label>
                        <select
                            value={formStatus}
                            onChange={e => setFormStatus(e.target.value as StatusChoice)}
                            className="block w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-card"
                        >
                            <option value="closed">強制關閉</option>
                            <option value="open">強制開放</option>
                            <option value="auto">恢復自動</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                        {formStart === formEnd
                            ? `將套用 1 天`
                            : `將套用 ${getDatesInRange(formStart, formEnd).length} 天`}
                        ，館別：{formBuilding}，狀態：{STATUS_DISPLAY[formStatus]?.label}
                    </p>
                    <button
                        onClick={handleAddRule}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        {submitting ? '套用中...' : '套用規則'}
                    </button>
                </div>
            </div>

            {/* 現有 Override 列表 */}
            <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700">現有規則（{activeOverrides.length} 筆）</h3>
                    <p className="text-xs text-slate-500 mt-0.5">僅顯示非「自動」的 Override 項目</p>
                </div>
                {activeOverrides.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">目前沒有任何 Override 規則</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <table className="hidden md:table w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700">日期</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700">館別</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700">狀態</th>
                                    <th className="px-5 py-3 text-right font-bold text-slate-700">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeOverrides.map(o => {
                                    const { label, badge } = STATUS_DISPLAY[o.status] ?? STATUS_DISPLAY.auto;
                                    return (
                                        <tr key={`${o.date}-${o.building}`} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-3 font-mono text-slate-800">{o.date}</td>
                                            <td className="px-5 py-3 font-medium text-slate-700">{o.building}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{label}</span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <button
                                                    onClick={() => handleDelete(o.date, o.building)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200"
                                                    title="移除此規則（恢復自動）"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {activeOverrides.map(o => {
                                const { label, badge } = STATUS_DISPLAY[o.status] ?? STATUS_DISPLAY.auto;
                                return (
                                    <div key={`${o.date}-${o.building}`} className="flex items-center justify-between px-4 py-3">
                                        <div className="space-y-0.5">
                                            <p className="font-mono text-sm text-slate-800">{o.date}</p>
                                            <p className="text-xs text-slate-500">{o.building}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{label}</span>
                                            <button
                                                onClick={() => handleDelete(o.date, o.building)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
