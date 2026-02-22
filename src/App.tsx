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
import { useTripManager } from './hooks/useTripManager';
import { initializeDB } from './db';

function App() {
  const [activeTab, setActiveTab] = useState<TabType | 'album'>('itinerary');
  const [isReady, setIsReady] = useState(false);
  const { activeTripId, selectTrip, loading: managerLoading } = useTripManager();

  useEffect(() => {
    initializeDB().then(() => setIsReady(true));
  }, []);

  if (!isReady || managerLoading) {
    return <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--fuji-blue)', color: 'white' }}>載入中...</div>;
  }

  if (!activeTripId) {
    return (
      <div className="app-container">
        <TripDashboard onSelectTrip={selectTrip} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header tripId={activeTripId} onBack={() => selectTrip(null)} />
      <main className="main-content">
        <div style={{ display: activeTab === 'itinerary' ? 'block' : 'none', height: '100%' }}>
          <Itinerary tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'expense' ? 'block' : 'none', height: '100%' }}>
          <ExpenseTracker tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'exchange' ? 'block' : 'none', height: '100%' }}>
          <ExchangeRate tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'ticket' ? 'block' : 'none', height: '100%' }}>
          <TicketWallet tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'checklist' ? 'block' : 'none', height: '100%' }}>
          <PackingChecklist tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'album' ? 'block' : 'none', height: '100%' }}>
          <PhotoAlbum tripId={activeTripId} />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%' }}>
          <NearbyInfo tripId={activeTripId} />
        </div>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
