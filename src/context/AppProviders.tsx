import React from 'react';
import { AuthProvider } from './AuthContext';
import { UIProvider } from './UIContext';
import { SeatProvider } from './SeatContext';
import { AnnouncementProvider } from './AnnouncementContext';

interface ComposeProps {
    providers: Array<React.ComponentType<{ children: React.ReactNode }>>;
    children: React.ReactNode;
}

const ComposeProviders = ({ providers, children }: ComposeProps) => {
    return (
        <>
            {providers.reduceRight((acc, Provider) => {
                return <Provider>{acc}</Provider>;
            }, children)}
        </>
    );
};

export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ComposeProviders 
            providers={[
                AuthProvider,
                UIProvider,
                SeatProvider,
                AnnouncementProvider
            ]}
        >
            {children}
        </ComposeProviders>
    );
}
