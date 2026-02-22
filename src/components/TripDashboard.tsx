import { useTripManager } from '../hooks/useTripManager';
import { Plus, Map, Trash2, CalendarDays } from 'lucide-react';
import { useState } from 'react';

export function TripDashboard({ onSelectTrip }: { onSelectTrip: (id: string) => void }) {
    const { trips, loading, createTrip, deleteTrip } = useTripManager();
    const [newTripName, setNewTripName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    if (loading) return <div className="tab-placeholder fade-in">載入行程庫中...</div>;

    const handleCreate = async () => {
        if (!newTripName.trim() || !startDate || !endDate) {
            alert('請完整輸入行程名稱與日期區間');
            return;
        }
        const newId = await createTrip(newTripName.trim(), startDate, endDate);
        onSelectTrip(newId);
        setNewTripName('');
        setStartDate('');
        setEndDate('');
        setIsCreating(false);
    };

    return (
        <div className="trip-dashboard fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '40px' }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--fuji-blue)', borderRadius: '24px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 24px rgba(52, 88, 153, 0.3)' }}>
                    <Map size={40} />
                </div>
                <h1 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '8px' }}>我的行程庫</h1>
                <p style={{ color: 'var(--text-light)' }}>隨時切換與管理您的所有旅程</p>
            </div>

            <button
                className="btn-add-attraction"
                style={{ width: '100%', marginBottom: '24px', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 'bold' }}
                onClick={() => setIsCreating(!isCreating)}
            >
                <Plus size={24} /> 建立新的行程
            </button>

            {isCreating && (
                <div className="address-card fade-in" style={{ marginBottom: '24px', padding: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>為這趟旅程命名與設定日期</h3>
                    <input
                        type="text"
                        placeholder="例如：2025 大阪五星爆吃之旅"
                        value={newTripName}
                        onChange={(e) => setNewTripName(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '16px' }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '130px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>出發日期</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-light)', display: 'block', marginBottom: '4px' }}>結束日期</label>
                            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-cancel" style={{ flex: 1 }} onClick={() => setIsCreating(false)}>取消</button>
                        <button className="btn-save" style={{ flex: 1 }} onClick={handleCreate}>確認開團</button>
                    </div>
                </div>
            )}

            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-dark)', marginBottom: '16px' }}>已儲存的行程 ({trips.length})</h3>

            <div className="trip-grid desktop-grid" style={{ marginBottom: '100px' }}>
                {trips.length === 0 && !isCreating ? (
                    <div className="empty-state" style={{ padding: '40px 20px', borderRadius: '16px', border: '2px dashed #ddd' }}>
                        尚無任何行程記錄
                    </div>
                ) : (
                    trips.map(trip => (
                        <div key={trip.id} className="address-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }} onClick={() => onSelectTrip(trip.id)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ backgroundColor: 'rgba(52, 88, 153, 0.1)', color: 'var(--fuji-blue)', padding: '10px', borderRadius: '12px' }}>
                                    <CalendarDays size={24} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{trip.name}</h4>
                                    <p style={{ fontSize: '0.85rem', color: '#999' }}>建立於 {new Date(trip.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <button
                                className="btn-delete-ticket"
                                style={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: 'transparent', color: '#ccc' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTrip(trip.id);
                                }}
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
