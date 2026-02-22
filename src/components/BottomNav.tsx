import { Map, Ticket, Settings, Wallet, ListChecks, Image as ImageIcon, Calculator } from 'lucide-react';
import clsx from 'clsx';

export type TabType = 'itinerary' | 'expense' | 'ticket' | 'checklist' | 'album' | 'settings' | 'exchange';

interface BottomNavProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
    return (
        <nav className="bottom-nav" style={{
            display: 'flex',
            padding: '8px 4px',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <button
                className={clsx('nav-item', activeTab === 'itinerary' && 'active')}
                onClick={() => onTabChange('itinerary')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <Map className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>行程</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'exchange' && 'active')}
                onClick={() => onTabChange('exchange')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <Calculator className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>匯率</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'expense' && 'active')}
                onClick={() => onTabChange('expense')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <Wallet className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>記帳</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'ticket' && 'active')}
                onClick={() => onTabChange('ticket')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <Ticket className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>票夾</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'checklist' && 'active')}
                onClick={() => onTabChange('checklist')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <ListChecks className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>清單</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'album' && 'active')}
                onClick={() => onTabChange('album')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <ImageIcon className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>相簿</span>
            </button>
            <button
                className={clsx('nav-item', activeTab === 'settings' && 'active')}
                onClick={() => onTabChange('settings')}
                style={{ flex: 1, padding: '4px 2px' }}
            >
                <Settings className="nav-icon" size={22} />
                <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>設定</span>
            </button>
        </nav>
    );
}
