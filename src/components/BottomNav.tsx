import { Map, Ticket, Settings, Wallet, ListChecks, Image as ImageIcon, Calculator } from 'lucide-react';
import clsx from 'clsx';

export type TabType = 'itinerary' | 'expense' | 'ticket' | 'checklist' | 'album' | 'settings' | 'exchange';

interface BottomNavProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

const TABS: { id: TabType; label: string; Icon: typeof Map }[] = [
    { id: 'itinerary', label: '行程', Icon: Map },
    { id: 'exchange', label: '匯率', Icon: Calculator },
    { id: 'expense', label: '記帳', Icon: Wallet },
    { id: 'ticket', label: '票夾', Icon: Ticket },
    { id: 'checklist', label: '清單', Icon: ListChecks },
    { id: 'album', label: '相簿', Icon: ImageIcon },
    { id: 'settings', label: '設定', Icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    return (
        <nav className="bottom-nav" aria-label="主選單">
            <div className="bottom-nav-inner">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        className={clsx('nav-item', activeTab === id && 'active')}
                        onClick={() => onTabChange(id)}
                        aria-current={activeTab === id ? 'page' : undefined}
                    >
                        <Icon size={22} aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
