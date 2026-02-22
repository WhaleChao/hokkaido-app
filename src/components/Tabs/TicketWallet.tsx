import { useRef, useEffect, useState } from 'react';
import { Upload, Trash2, Ticket as TicketIcon, Plane } from 'lucide-react';
import { useTicketStore, type TicketType } from '../../hooks/useTicketStore';

export function TicketWallet({ tripId }: { tripId: string }) {
    const { tickets, loading, addTicket, removeTicket } = useTicketStore(tripId);
    const [showAddForm, setShowAddForm] = useState(false);

    // New Ticket Form State
    const [newTitle, setNewTitle] = useState('');
    const [newType, setNewType] = useState<TicketType>('transit');
    const [newPayload, setNewPayload] = useState('');

    const privateInputRef = useRef<HTMLInputElement>(null);
    const publicInputRef = useRef<HTMLInputElement>(null);
    const [privateBlob, setPrivateBlob] = useState<Blob | null>(null);
    const [publicBlob, setPublicBlob] = useState<Blob | null>(null);

    const convertToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    if (loading) return <div className="tab-placeholder fade-in">載入票夾中...</div>;

    const handlePrivateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setPrivateBlob(e.target.files[0]);
    };

    const handlePublicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setPublicBlob(e.target.files[0]);
    };

    const handleSaveTicket = async () => {
        if (!newTitle) {
            alert('請輸入票券名稱 (如: 京成電鐵、航班號碼)');
            return;
        }

        // Convert the public blob to base64 if it exists for easy sharing later
        let publicB64 = undefined;
        if (publicBlob) {
            publicB64 = await convertToBase64(publicBlob);
        }

        await addTicket({
            title: newTitle,
            type: newType,
            textPayload: newPayload,
            privateImageBlob: privateBlob || undefined,
            publicTutorialBlob: publicBlob || undefined,
            publicTutorialBase64: publicB64
        });

        // Reset
        setNewTitle('');
        setNewPayload('');
        setPrivateBlob(null);
        setPublicBlob(null);
        setShowAddForm(false);
    };

    const flights = tickets.filter(t => t.type === 'flight');
    const transits = tickets.filter(t => t.type === 'transit' || t.type === 'other');

    return (
        <div className="ticket-view fade-in">
            <div className="ticket-header" style={{ marginBottom: '16px' }}>
                <h2><TicketIcon className="inline-icon" /> 我的專屬票夾</h2>
                <p>所有票券包含私密 QR 都安全儲存於本機裝置，無需網路即可查看。</p>
                {!showAddForm && (
                    <button className="btn-upload" onClick={() => setShowAddForm(true)}>
                        <Upload size={18} /> 新增車票/航班/票券
                    </button>
                )}
            </div>

            {showAddForm && (
                <div className="address-card" style={{ padding: '16px', marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '12px' }}>新增票券</h3>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>類型</label>
                        <select value={newType} onChange={e => setNewType(e.target.value as TicketType)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                            <option value="transit">交通票券 (如: JR Pass, 72HR券)</option>
                            <option value="flight">航班資訊 (航班號, 航廈)</option>
                            <option value="other">其他</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>標題名稱</label>
                        <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="如: 星宇航空 JX800" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>純文字備註 (選填)</label>
                        <input type="text" value={newPayload} onChange={e => setNewPayload(e.target.value)} placeholder="如: 第2航廈 / 10:30 起飛" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>上傳個人專屬憑證 / QR Code (私密・不可分享)</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn-edit" onClick={() => privateInputRef.current?.click()} style={{ flex: 1 }}>選擇圖片</button>
                            <span style={{ fontSize: '0.8rem', color: privateBlob ? 'green' : '#999' }}>{privateBlob ? '已選擇1張' : '未選擇'}</span>
                        </div>
                        <input type="file" ref={privateInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePrivateChange} />
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label>上傳換票教學/地圖 (公開・可連同行程分享)</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button className="btn-edit" onClick={() => publicInputRef.current?.click()} style={{ flex: 1 }}>選擇圖片</button>
                            <span style={{ fontSize: '0.8rem', color: publicBlob ? 'green' : '#999' }}>{publicBlob ? '已選擇1張' : '未選擇'}</span>
                        </div>
                        <input type="file" ref={publicInputRef} style={{ display: 'none' }} accept="image/*" onChange={handlePublicChange} />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn-cancel" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>取消</button>
                        <button className="btn-save" onClick={handleSaveTicket} style={{ flex: 1 }}>儲存</button>
                    </div>
                </div>
            )}

            {flights.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h3 className="section-title"><Plane size={24} style={{ color: 'var(--accent-primary)', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />航班與航廈資訊</h3>
                    <div className="desktop-grid">
                        {flights.map(flight => (
                            <div key={flight.id} className="address-card" style={{ padding: '16px', marginBottom: '16px', position: 'relative' }}>
                                <button className="btn-delete-ticket" onClick={() => removeTicket(flight.id)} style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                    <Trash2 size={16} />
                                </button>
                                <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{flight.title}</h4>
                                {flight.textPayload && <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '16px' }}>{flight.textPayload}</p>}
                                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                                    {flight.privateImageBlob && <TicketImage blob={flight.privateImageBlob} label="個人憑證 (私密)" />}
                                    {flight.publicTutorialBlob && <TicketImage blob={flight.publicTutorialBlob} label="報到指南 (可分享)" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {transits.length > 0 && (
                <div>
                    <h3 className="section-title"><TicketIcon size={24} style={{ color: 'var(--accent-primary)', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />交通與活動票券</h3>
                    <div className="desktop-grid">
                        {transits.map(transit => (
                            <div key={transit.id} className="address-card" style={{ padding: '16px', marginBottom: '16px', position: 'relative' }}>
                                <button className="btn-delete-ticket" onClick={() => removeTicket(transit.id)} style={{ position: 'absolute', top: '16px', right: '16px' }}>
                                    <Trash2 size={16} />
                                </button>
                                <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{transit.title}</h4>
                                {transit.textPayload && <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '16px' }}>{transit.textPayload}</p>}
                                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                                    {transit.privateImageBlob && <TicketImage blob={transit.privateImageBlob} label="兌換 QR (私密)" />}
                                    {transit.publicTutorialBlob && <TicketImage blob={transit.publicTutorialBlob} label="換票教學 (可分享)" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {flights.length === 0 && transits.length === 0 && !showAddForm && (
                <div className="empty-state">尚未新增任何票券</div>
            )}
        </div>
    );
}

function TicketImage({ blob, label }: { blob: Blob, label: string }) {
    const [objectUrl, setObjectUrl] = useState<string>('');

    useEffect(() => {
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [blob]);

    if (!objectUrl) return null;

    return (
        <div style={{ minWidth: '200px', flex: 1 }}>
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px', textAlign: 'center' }}>{label}</p>
            <div className="ticket-item" style={{ margin: 0 }}>
                <div className="ticket-image-container">
                    <img src={objectUrl} alt="Ticket Data" className="ticket-image" />
                </div>
            </div>
        </div>
    );
}
