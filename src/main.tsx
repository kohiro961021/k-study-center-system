import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthProvider, SystemProvider } from './context';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <SystemProvider>
                <App />
            </SystemProvider>
        </AuthProvider>
    </StrictMode>,
);
