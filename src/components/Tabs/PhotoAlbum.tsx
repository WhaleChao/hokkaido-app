import { useState } from 'react';
import { useItinerary } from '../../hooks/useItinerary';
import { usePhotoAlbum } from '../../hooks/usePhotoAlbum';
import { Link, Image as ImageIcon, ExternalLink, Save, Edit3, Trash2 } from 'lucide-react';

export function PhotoAlbum({ tripId }: { tripId: string }) {
    const { days, loading: itineraryLoading } = useItinerary(tripId);
    const { loading: albumsLoading, saveAlbumLink, removeAlbumLink, getUrlForDay } = usePhotoAlbum(tripId);

    const [editingDayId, setEditingDayId] = useState<string | null>(null);
    const [tempUrl, setTempUrl] = useState('');

    if (itineraryLoading || albumsLoading) return <div className="tab-placeholder fade-in">載入相簿資訊中...</div>;

    const handleEditClick = (dayId: string, currentUrl: string) => {
        setTempUrl(currentUrl);
        setEditingDayId(dayId);
    };

    const handleSave = async (dayId: string) => {
        if (!tempUrl.trim()) {
            await removeAlbumLink(dayId);
        } else {
            // Basic URL validation
            let finalUrl = tempUrl.trim();
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }
            await saveAlbumLink(dayId, finalUrl);
        }
        setEditingDayId(null);
    };

    return (
        <div className="fade-in" style={{ paddingBottom: '80px' }}>
            <div style={{ backgroundColor: 'var(--sage-green)', color: 'white', padding: '24px 20px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 8px 16px rgba(135, 169, 107, 0.2)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageIcon size={24} /> 共享相簿集
                </h2>
                <p style={{ opacity: 0.9, fontSize: '0.9rem', lineHeight: 1.5 }}>
                    您可以為每天的行程綁定 Google Photos 或 LINE 相簿網址。只要貼上連結，所有同行朋友都能一鍵前往上傳、下載當天的美照！
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {days.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px 20px' }}>
                        請先建立行程，即可為每一天分配專屬相簿連結。
                    </div>
                )}
                {days.map((day, index) => {
                    const currentUrl = getUrlForDay(day.id);
                    const isEditing = editingDayId === day.id;

                    return (
                        <div key={day.id} className="address-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ backgroundColor: 'var(--sage-green)', color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: '0.8rem' }}>Day {index + 1}</span>
                                    {day.date}
                                </h3>
                                {!isEditing && currentUrl && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleEditClick(day.id, currentUrl)} style={{ background: 'none', border: 'none', color: 'var(--text-light)', padding: '4px' }}>
                                            <Edit3 size={18} />
                                        </button>
                                        <button onClick={() => removeAlbumLink(day.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', padding: '4px' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Link size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: '#999' }} />
                                        <input
                                            type="url"
                                            className="album-input"
                                            value={tempUrl}
                                            onChange={(e) => setTempUrl(e.target.value)}
                                            placeholder="貼上 Google 相簿分享連結 (留空為刪除)"
                                            style={{ width: '100%', padding: '10px 10px 10px 32px', borderRadius: '8px', border: '1px solid var(--sage-green)', fontSize: '0.95rem' }}
                                            autoFocus
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => setEditingDayId(null)}
                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'transparent', fontWeight: 600, color: 'var(--text-light)' }}
                                        >取消</button>
                                        <button
                                            onClick={() => handleSave(day.id)}
                                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--sage-green)', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        ><Save size={16} /> 儲存連結</button>
                                    </div>
                                </div>
                            ) : currentUrl ? (
                                <a
                                    href={currentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--snow-white)', border: '2px solid var(--sage-green)', color: 'var(--sage-green)', padding: '12px', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}
                                >
                                    <ExternalLink size={18} /> 前往瀏覽 / 新增照片
                                </a>
                            ) : (
                                <button
                                    onClick={() => handleEditClick(day.id, '')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc', color: 'var(--text-light)', padding: '12px', borderRadius: '12px', fontWeight: 500 }}
                                >
                                    <Link size={18} /> 點此貼上連結 (如 Line 相簿)
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
