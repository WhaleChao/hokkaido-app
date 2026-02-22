import { useConfigStore } from '../hooks/useConfigStore';
import { ChevronLeft } from 'lucide-react';

interface HeaderProps {
    tripId: string;
    onBack: () => void;
}

export function Header({ tripId, onBack }: HeaderProps) {
    const { config } = useConfigStore(tripId);

    // Format dates to simple MM/DD format
    const formatStr = (dStr: string) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <header className="app-header" style={{ position: 'relative' }}>
            <button
                onClick={onBack}
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'white', padding: '8px', cursor: 'pointer', zIndex: 10 }}
            >
                <ChevronLeft size={28} />
            </button>
            <div className="header-content" style={{ paddingLeft: '40px' }}>
                <h1 className="header-title" style={{ fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.tripName || '未命名旅程'}</h1>
                <p className="header-date" style={{ fontSize: '0.8rem' }}>
                    {config.location} ✈️ {formatStr(config.startDate)} - {formatStr(config.endDate)}
                </p>
            </div>
        </header>
    );
}
