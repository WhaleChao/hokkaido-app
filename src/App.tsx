import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, type TabType } from './components/BottomNav';
import { Itinerary } from './components/Tabs/Itinerary';
import { ExpenseTracker } from './components/Tabs/ExpenseTracker';
import { TicketWallet } from './components/Tabs/TicketWallet';
import { PackingChecklist } from './components/Tabs/PackingChecklist';
import { NearbyInfo } from './components/Tabs/NearbyInfo';
import { PhotoAlbum } from './components/Tabs/PhotoAlbum';
import { ExchangeRate } from './components/Tabs/ExchangeRate';
import { TripDashboard } from './components/TripDashboard';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useTripManager } from './hooks/useTripManager';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { requestPersistence } from './db';

const PANELS: { id: TabType; label: string; render: (tripId: string) => React.ReactNode }[] = [
    { id: 'itinerary', label: '行程', render: (id) => <Itinerary tripId={id} /> },
    { id: 'exchange', label: '匯率', render: (id) => <ExchangeRate tripId={id} /> },
    { id: 'expense', label: '記帳', render: (id) => <ExpenseTracker tripId={id} /> },
    { id: 'ticket', label: '票夾', render: (id) => <TicketWallet tripId={id} /> },
    { id: 'checklist', label: '行李清單', render: (id) => <PackingChecklist tripId={id} /> },
    { id: 'album', label: '相簿', render: (id) => <PhotoAlbum tripId={id} /> },
    { id: 'settings', label: '設定', render: (id) => <NearbyInfo tripId={id} /> },
];

function App() {
    const [activeTab, setActiveTab] = useState<TabType>('itinerary');
    const manager = useTripManager();
    const online = useOnlineStatus();
    const { activeTripId, selectTrip, loading } = manager;

    useEffect(() => {
        void requestPersistence();
    }, []);

    if (loading) return <div className="loading" role="status">載入中…</div>;

    return (
        <>
            <a className="skip-link" href="#main">
                跳到主要內容
            </a>
            {!online && (
                <div className="status-bar" role="status">
                    目前沒有網路。行程、記帳、票券都能照常使用；天氣與匯率會顯示上次存下的資料。
                </div>
            )}
            {!activeTripId ? (
                <TripDashboard manager={manager} />
            ) : (
                <div className="app">
                    <Header
                        tripId={activeTripId}
                        onBack={() => {
                            setActiveTab('itinerary');
                            void selectTrip(null);
                        }}
                    />
                    <main className="main" id="main" tabIndex={-1}>
                        {PANELS.map((p) => (
                            <section key={p.id} hidden={activeTab !== p.id} aria-label={p.label}>
                                {p.render(activeTripId)}
                            </section>
                        ))}
                    </main>
                    <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
            )}
            <UpdatePrompt />
        </>
    );
}

export default App;
