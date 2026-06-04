import { useState, useEffect } from 'react';
import { FileText, RefreshCw, MessageSquare, Edit3 } from 'lucide-react';
import { useApi } from '../../hooks';
import { useUI, useSeats } from '../../context';
import { NoteEntry, SeatData } from '../../type';

export function NoteView() {
    const apiCall = useApi();
    const { setAdminMessage } = useUI();
    const { seats, setSeats } = useSeats();
    
    const [notesList, setNotesList] = useState<NoteEntry[]>([]);
    const [editingSeatNote, setEditingSeatNote] = useState<SeatData | null>(null);
    const [noteText, setNoteText] = useState('');

    const fetchSeats = async () => { try { setSeats(await apiCall('/api/seats')); } catch { } };
    const fetchNotesList = async () => { try { setNotesList(await apiCall('/api/admin/notes')); } catch { } };

    useEffect(() => {
        fetchNotesList();
        fetchSeats();
    }, []);

    const handleSaveSeatNote = async () => {
        if (!editingSeatNote) return;
        try { 
            await apiCall(`/api/admin/seats/${editingSeatNote.id}/note`, 'PUT', { note: noteText });
            setEditingSeatNote(null); 
            fetchSeats(); 
            fetchNotesList();
            setAdminMessage('註記已更新'); 
        } catch (err: any) { setAdminMessage(`更新失敗: ${err.message}`); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="w-6 h-6 text-amber-600" />座位註記總覽</h2>
                <button onClick={fetchNotesList} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex items-center gap-1 transition"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {notesList.length === 0 ? (
                <div className="p-8 text-center bg-card/70 glass-card rounded-2xl border border-slate-200 text-slate-500">目前沒有任何座位有註記</div>
            ) : (
                <div className="bg-card/70 glass-card rounded-2xl border border-slate-200 overflow-hidden">
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
                                        <td className="px-4 py-3 font-bold text-accent">{n.seat_number}</td>
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

            {editingSeatNote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit3 className="w-5 h-5 text-amber-600" />編輯座位 {editingSeatNote.label} 註記</h3>
                        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="輸入註記（如：靠窗、有插座、冷氣出風口等）" className="w-full border border-slate-200 rounded-lg p-3 text-sm h-24 outline-none focus:ring-2 focus:ring-amber-400" />
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setEditingSeatNote(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-medium text-sm">取消</button>
                            <button onClick={handleSaveSeatNote} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 transition">儲存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
