import { useConfigStore } from '../hooks/useConfigStore';
import { visibleLocation } from '../data/config';
import { formatMD } from '../utils/date';
import { ChevronLeft } from 'lucide-react';

interface HeaderProps {
    tripId: string;
    onBack: () => void;
}

export function Header({ tripId, onBack }: HeaderProps) {
    const { config } = useConfigStore(tripId);
    const loc = visibleLocation(config.location);
    const range = config.startDate && config.endDate ? `${formatMD(config.startDate)} – ${formatMD(config.endDate)}` : '';

    return (
        <header className="app-header">
            <button type="button" className="btn-icon" onClick={onBack} aria-label="回到行程庫">
                <ChevronLeft size={26} aria-hidden="true" />
            </button>
            <div className="header-text">
                <h1 className="header-title">{config.tripName || '未命名旅程'}</h1>
                <p className="header-sub">{[loc, range].filter(Boolean).join('・') || '尚未設定地點與日期'}</p>
            </div>
        </header>
    );
}
