import { Megaphone, Pin, Edit3, Trash2 } from 'lucide-react';
import { useUI, useAnnouncements } from '../../context';
import { renderMarkdown } from '../../utils/helper';

export function AdminAnnouncementView() {
    const { adminMessage, setAdminMessage } = useUI();
    const { 
        announcements,
        annTitle, setAnnTitle,
        annContent, setAnnContent,
        annPinned, setAnnPinned,
        editingAnn, setEditingAnn,
        handleCreateAnnouncement,
        handleUpdateAnnouncement,
        handleDeleteAnnouncement
    } = useAnnouncements();

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-amber-600" />公告管理</h2>
            {adminMessage && <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200 flex items-center justify-between"><span>{adminMessage}</span><button onClick={() => setAdminMessage(null)} className="text-amber-600 font-bold">✕</button></div>}

            {/* Create / Edit form */}
            <div className="bg-card glass-card rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">{editingAnn ? `編輯公告 #${editingAnn.id}` : '發布新公告'}</h3>
            <div className="space-y-3">
                <div>
                    <label className="text-sm font-medium text-slate-600">標題</label>
                    <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="輸入公告標題" className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 bg-input" />
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
                    {editingAnn ? (
                        <>
                            <button onClick={handleUpdateAnnouncement} className="bg-amber-500 hover:bg-amber-400 text-white px-5 py-2 rounded-lg font-bold text-sm transition">更新公告</button>
                            <button onClick={() => { setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm transition">取消</button>
                        </>
                    ) : (
                        <button onClick={handleCreateAnnouncement} className="bg-accent hover:bg-accent-hover text-[#fff] px-5 py-2 rounded-lg font-bold text-sm transition">發布公告</button>
                    )}
                </div>
            </div>
            </div>

            {/* Existing announcements */}
            {announcements.length > 0 && (
            <div className="space-y-3">
                <h3 className="text-base font-bold text-slate-700">已發布的公告</h3>
                {announcements.map(ann => (
                <div key={ann.id} className={`bg-card/70 glass-card rounded-2xl border p-5 shadow-sm ${ann.is_pinned ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
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
    );
}
