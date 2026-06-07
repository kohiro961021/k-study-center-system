import { Printer } from 'lucide-react';

interface PrintButtonProps {
    onClick: () => void;
    className?: string;
}

export function PrintButton({ onClick, className = '' }: PrintButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1.5 transition ${className}`}
            title="列印"
        >
            <Printer className="w-4 h-4" />
            列印
        </button>
    );
}
