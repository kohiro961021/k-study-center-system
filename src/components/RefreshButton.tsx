import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
    onClick: () => void;
}

export function RefreshButton({ onClick }: RefreshButtonProps) {
    return (
        <button
            onClick={onClick}
            className="bg-card-alt hover:opacity-80 text-slate-700 px-3 py-2 rounded-full font-bold text-sm flex items-center gap-1 transition border border-slate-200"
            title="重新整理"
        >
            <RefreshCw className="w-4 h-4" />
        </button>
    );
}
