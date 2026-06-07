import { useEffect } from 'react';
import { Clock, Sun, Moon, User, Lock, AlertCircle, Megaphone, Pin } from 'lucide-react'

import { useAuth, useUI, useAnnouncements } from '../context';

import { GOOGLE_CLIENT_ID } from '../constants';

import { useCurrentTime } from '../hooks';

import { renderMarkdown } from '../utils';



export const LoginView = () => {
    const { handleLogin, error, loading } = useAuth();
    const { theme, toggleTheme } = useUI();
    const { announcements, fetchAnnouncements } = useAnnouncements();
    const { dateString, timeString } = useCurrentTime();

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    return (
        <div className="min-h-screen bg-page noise-bg p-4 pb-16">

            {/* Clock bar + theme toggle */}
            <div className="flex justify-center items-center gap-3 mb-6 pt-4">
                {/* Clock */}
                <div className="inline-flex items-center gap-2 bg-card/80 glass-card rounded-full px-6 py-2 shadow-sm border border-slate-200">
                    <Clock className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-slate-700">{dateString}</span>
                    <span className="text-lg font-bold text-accent font-mono">{timeString}</span>
                </div>

                {/* Theme toggle button */}
                <button onClick={toggleTheme} className="p-2.5 rounded-full bg-card/80 glass-card border border-slate-200 shadow-sm text-slate-600 hover:text-accent transition" title={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}>
                    {theme === 'dark' ? <Sun className="w-4 h-4 theme-toggle-icon" /> : <Moon className="w-4 h-4 theme-toggle-icon" />}
                </button>
            </div>

            {/* Login form */}
            <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto items-start justify-center">

                {/* Login card */}
                <div className="w-full max-w-md bg-card/80 glass-card rounded-4xl shadow-xl p-8 border border-slate-200">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <img src="/fssh-badge.png" alt="鳳山高中校徽" className="w-12 h-12 drop-shadow-md rounded-4xl" />
                        <h1 className="text-2xl font-bold text-slate-900">鳳山高中 K書中心</h1>
                    </div>

                    {/* Login form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">學號</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" name="studentId" required placeholder="輸入學號" className="w-full pl-10 pr-3 py-2 bg-input border border-slate-200 rounded-lg outline-none" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">密碼</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="password" name="password" required placeholder="輸入密碼" className="w-full pl-10 pr-3 py-2 bg-input border border-slate-200 rounded-lg outline-none" />
                            </div>
                        </div>

                        {error && 
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />{error}
                            </div>
                        }

                        <button type="submit" disabled={loading} className="w-full mt-4 bg-accent hover:bg-accent-hover text-[#fff] font-bold py-2.5 px-4 rounded-lg disabled:opacity-50 transition shadow-md hover:shadow-lg">
                            {loading ? '登入中...' : '登入'}
                        </button>

                        {GOOGLE_CLIENT_ID && (
                            <>
                                <div className="text-center text-sm text-slate-500 mt-4">── 或使用Google帳號 ──</div>

                                <div className="mt-8">
                                    <div id="google-signin-btn" className="flex justify-center" />
                                </div>
                            </>
                        )}

                    </form>

                </div>

                {/* Announcements */}
                {announcements.length > 0 && (
                    <div className="w-full max-w-md rounded-4xl bg-card/80 glass-card rounded-2xl shadow-xl p-6 border border-slate-200">

                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                            <Megaphone className="w-5 h-5 text-amber-500" />公告欄
                        </h2>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                            {announcements.slice(0, 5).map(ann => (
                                <div key={ann.id} className={`rounded-xl p-4 border-2 ${ann.is_pinned ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50/80 border-slate-200'}`}>

                                    <div className="flex items-center gap-2 mb-1">
                                        {ann.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                                        <span className="font-bold text-lg text-slate-900">{ann.title}</span>
                                    </div>

                                    <div className="text-xs text-slate-500 mb-2">{ann.author_name} · {ann.created_at}</div>

                                    <div className="prose-sm text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
            
            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full bg-page/90 backdrop-blur-sm text-center text-xs py-3  text-slate-500 z-50 border-t border-slate-200/50">
                &copy; {new Date().getFullYear()} 鳳山高中 K書中心預約系統&nbsp;
                <span className="mx-2 text-slate-300">|</span>
                <span>System Developed by&nbsp;

                    <a href="https://github.com/kohiro961021" 
                        target="_blank"
                        className="hover:text-accent transition-colors underline underline-offset-2">
                            Kohiro
                    </a>
                    &nbsp;&&nbsp;
                    <a href="https://github.com/Okowa0814" 
                        target="_blank"
                        className="hover:text-accent transition-colors underline underline-offset-2">
                            Okowa
                    </a>
                        
                </span>
            </div>
        </div>
    )
}