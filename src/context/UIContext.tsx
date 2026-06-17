import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { View } from '../type';

interface UIContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    view: View;
    setView: React.Dispatch<React.SetStateAction<View>>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    // === View state ===
    const [view, setView] = useState<View>('login');

    // === Theme state ===
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        localStorage.setItem('theme', next);
    };

    const value: UIContextType = {
        theme, toggleTheme,
        view, setView
    };

    return <UIContext.Provider value={value}> {children} </UIContext.Provider>;
}

export function useUI() {
    const context = useContext(UIContext);
    if (context === undefined) throw new Error('useUI must be used within a UIProvider');
    return context;
}
