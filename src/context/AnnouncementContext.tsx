import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AnnouncementData } from '../type';
import { useApi } from '../hooks';
import { useUI } from './UIContext';

interface AnnouncementContextType {
    announcements: AnnouncementData[];
    setAnnouncements: React.Dispatch<React.SetStateAction<AnnouncementData[]>>;
    
    annTitle: string;
    setAnnTitle: React.Dispatch<React.SetStateAction<string>>;
    
    annContent: string;
    setAnnContent: React.Dispatch<React.SetStateAction<string>>;
    
    annPinned: boolean;
    setAnnPinned: React.Dispatch<React.SetStateAction<boolean>>;
    
    editingAnn: AnnouncementData | null;
    setEditingAnn: React.Dispatch<React.SetStateAction<AnnouncementData | null>>;

    fetchAnnouncements: () => Promise<void>;
    handleCreateAnnouncement: () => Promise<void>;
    handleUpdateAnnouncement: () => Promise<void>;
    handleDeleteAnnouncement: (id: number) => Promise<void>;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export function AnnouncementProvider({ children }: { children: ReactNode }) {
    const apiCall = useApi();
    const { view } = useUI();

    const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annPinned, setAnnPinned] = useState(false);
    const [editingAnn, setEditingAnn] = useState<AnnouncementData | null>(null);

    const fetchAnnouncements = async () => {
        try {
            const res = await apiCall('/api/announcements');
            setAnnouncements(res);
        } catch {}
    };

    const handleCreateAnnouncement = async () => {
        if (!annTitle.trim() || !annContent.trim()) { alert('標題和內容不能為空'); return; }

        try {
            await apiCall('/api/admin/announcements', 'POST', { title: annTitle, content: annContent, is_pinned: annPinned });
            alert('公告已發布'); 
            setAnnTitle(''); setAnnContent(''); setAnnPinned(false); 
            fetchAnnouncements();
        } catch (err: any) { alert(`發布失敗: ${err.message}`); }
    };

    const handleUpdateAnnouncement = async () => {
        if (!editingAnn) return;

        try {
            await apiCall(`/api/admin/announcements/${editingAnn.id}`, 'PUT', { title: annTitle, content: annContent, is_pinned: annPinned });
            alert('公告已更新'); 
            setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setAnnPinned(false); 
            fetchAnnouncements();
        } catch (err: any) { alert(`更新失敗: ${err.message}`); }
    };

    const handleDeleteAnnouncement = async (id: number) => {
        if (!window.confirm('確定要刪除這則公告嗎？')) return;

        try { 
            await apiCall(`/api/admin/announcements/${id}`, 'DELETE'); 
            alert('公告已刪除'); 
            fetchAnnouncements(); 
        } catch (err: any) { alert(`刪除失敗: ${err.message}`); }
    };

    // Auto-fetch announcements when switching to related views
    useEffect(() => {
        if (view === 'announcements' || view === 'admin-announcements') fetchAnnouncements();
    }, [view]);

    const value: AnnouncementContextType = {
        announcements, setAnnouncements,
        annTitle, setAnnTitle,
        annContent, setAnnContent,
        annPinned, setAnnPinned,
        editingAnn, setEditingAnn,
        fetchAnnouncements,
        handleCreateAnnouncement,
        handleUpdateAnnouncement,
        handleDeleteAnnouncement
    };

    return <AnnouncementContext.Provider value={value}> {children} </AnnouncementContext.Provider>;
}

export function useAnnouncements() {
    const context = useContext(AnnouncementContext);
    if (context === undefined) throw new Error('useAnnouncements must be used within a AnnouncementProvider');
    return context;
}
