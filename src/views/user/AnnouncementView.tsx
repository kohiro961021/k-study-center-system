import { Megaphone, Pin } from 'lucide-react';
import { useAnnouncements } from '../../context';
import { renderMarkdown } from '../../utils';

export function AnnouncementView() {
    const { announcements } = useAnnouncements();

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-amber-500" />公告欄</h2>
            {announcements.length === 0 ? (
            <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">目前沒有公告</div>
            ) : (
            <div className="space-y-4">
                {announcements.map(ann => (
                <div key={ann.id} className={`bg-card/70 glass-card rounded-2xl border p-6 shadow-sm ${ann.is_pinned ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
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
    );
}
