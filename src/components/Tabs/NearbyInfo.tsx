import { useState } from 'react';
import { useConfigStore, type Accommodation } from '../../hooks/useConfigStore';
import { exportTripData, importTripData } from '../../utils/share';
import { Settings as SettingsIcon, MapPin, Search, Share2, Download, Plus, Trash2, Edit3, Link, Map as MapIcon, Users, Navigation, ShoppingCart, Coffee } from 'lucide-react';

export function NearbyInfo({ tripId }: { tripId: string }) {
    const { config, updateConfig, loading } = useConfigStore(tripId);

    // Accommodations state
    const [editingAccId, setEditingAccId] = useState<string | null>(null);
    const [tempAcc, setTempAcc] = useState<Partial<Accommodation>>({});
    const [showAddAcc, setShowAddAcc] = useState(false);

    // Sharing state
    const [importCode, setImportCode] = useState('');
    const [showImport, setShowImport] = useState(false);

    // Trip config states
    const [editTripConfig, setEditTripConfig] = useState(false);
    const [tripName, setTripName] = useState(config.tripName);
    const [location, setLocation] = useState(config.location);
    const [startDate, setStartDate] = useState(config.startDate);
    const [endDate, setEndDate] = useState(config.endDate);
    const [travelers, setTravelers] = useState<number | ''>(config.travelers || 1);
    const [baseCurrency, setBaseCurrency] = useState(config.baseCurrency || 'TWD');
    const [tripCurrency, setTripCurrency] = useState(config.tripCurrency || 'JPY');
    const [defaultRegion, setDefaultRegion] = useState(config.defaultRegion || '');

    if (loading) return <div className="tab-placeholder fade-in">載入資訊中...</div>;

    const handleSaveAcc = () => {
        if (!tempAcc.name || !tempAcc.address) {
            alert('名稱與地圖位址為必填！');
            return;
        }

        const accs = [...(config.accommodations || [])];
        if (editingAccId) {
            const index = accs.findIndex(a => a.id === editingAccId);
            if (index >= 0) {
                accs[index] = { ...accs[index], ...tempAcc } as Accommodation;
            }
        } else {
            accs.push({
                id: crypto.randomUUID(),
                name: tempAcc.name,
                address: tempAcc.address,
                url: tempAcc.url || ''
            });
        }
        updateConfig({ accommodations: accs });
        setEditingAccId(null);
        setShowAddAcc(false);
        setTempAcc({});
    };

    const handleEditAcc = (acc: Accommodation) => {
        setTempAcc(acc);
        setEditingAccId(acc.id);
        setShowAddAcc(true);
    };

    const handleDeleteAcc = (id: string) => {
        if (!window.confirm('確定刪除此住宿？')) return;
        const accs = (config.accommodations || []).filter(a => a.id !== id);
        updateConfig({ accommodations: accs });
    };

    const handleAddAcc = () => {
        setTempAcc({ name: '', address: '', url: '', checkIn: config.startDate, checkOut: config.endDate });
        setEditingAccId(null);
        setShowAddAcc(true);
    };

    const handleSaveTripConfig = () => {
        const finalTravelers = typeof travelers === 'number' && travelers >= 1 ? travelers : 1;
        updateConfig({ tripName, location, startDate, endDate, travelers: finalTravelers, baseCurrency, tripCurrency, defaultRegion });
        setTravelers(finalTravelers);
        setEditTripConfig(false);
    };

    const handleEditTripConfig = () => {
        setTripName(config.tripName);
        setLocation(config.location);
        setStartDate(config.startDate);
        setEndDate(config.endDate);
        setTravelers(config.travelers || 1);
        setDefaultRegion(config.defaultRegion || '');
        setEditTripConfig(true);
    };

    const executeSearch = (query: string) => {
        const accs = config.accommodations || [];
        if (accs.length === 0) {
            alert('請先設定您的民宿位址！');
            return;
        }
        // Use the first accommodation as the default query point if multiple exist
        const targetAddress = accs[0].address;
        const fullQuery = `${query} near ${targetAddress}`;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`, '_blank');
    };

    const handleExport = async () => {
        try {
            const code = await exportTripData(tripId);
            if (navigator.share) {
                await navigator.share({
                    title: '我的專屬行程表',
                    text: `把這個行程碼貼進你的 App：\n\n${code}`,
                });
            } else {
                await navigator.clipboard.writeText(code);
                alert('行程碼已複製到剪貼簿！請將它貼給朋友。');
            }
        } catch (e: any) {
            alert(e.message || '匯出失敗');
        }
    };

    const handleImport = async () => {
        if (!importCode.trim()) return;
        if (!window.confirm('警告：這將會覆蓋您目前的行程（車票不會被刪除）。確定要繼續嗎？')) return;

        const success = await importTripData(tripId, importCode.trim());
        if (success) {
            alert('行程匯入成功！系統將重新載入。');
            window.location.reload();
        } else {
            alert('匯入失敗，請確認行程碼是否完整。');
        }
    };

    return (
        <div className="nearby-view fade-in">
            <h3 className="section-title"><SettingsIcon className="inline-icon" size={20} /> 旅程設定</h3>
            <div className="address-card">
                {editTripConfig ? (
                    <div className="trip-config-edit">
                        <div className="form-group">
                            <label>旅程名稱</label>
                            <input type="text" value={tripName} onChange={e => setTripName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>主要地點 (英文佳，用於天氣查詢)</label>
                            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例如: Kyoto, Japan" />
                        </div>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>全域搜尋前綴 (自動加在 Google Maps 搜尋字首)</label>
                            <input type="text" value={defaultRegion} onChange={e => setDefaultRegion(e.target.value)} placeholder="例如: 東京" />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>設定後，點擊無詳細地址的景點導航時，會自動幫您加上此地區名稱以防導航漂移。</p>
                        </div>
                        <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label>出發日</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>結束日</label>
                                <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label>同行人數 (分帳與統計用)</label>
                            <input type="number" min="1" value={travelers} onChange={e => setTravelers(e.target.value === '' ? '' : Number(e.target.value))} placeholder="例如: 2" />
                        </div>
                        <div className="form-group" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label>旅行當地幣值</label>
                                <select value={tripCurrency} onChange={e => setTripCurrency(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                    <option value="JPY">日圓 (JPY)</option>
                                    <option value="KRW">韓元 (KRW)</option>
                                    <option value="USD">美金 (USD)</option>
                                    <option value="EUR">歐元 (EUR)</option>
                                    <option value="THB">泰銖 (THB)</option>
                                    <option value="TWD">台幣 (TWD)</option>
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>我的結算幣值</label>
                                <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                                    <option value="TWD">台幣 (TWD)</option>
                                    <option value="HKD">港幣 (HKD)</option>
                                    <option value="USD">美金 (USD)</option>
                                    <option value="SGD">新幣 (SGD)</option>
                                    <option value="MYR">馬幣 (MYR)</option>
                                    <option value="JPY">日圓 (JPY)</option>
                                </select>
                            </div>
                        </div>
                        <button className="btn-save" style={{ width: '100%', marginTop: '10px' }} onClick={handleSaveTripConfig}>儲存設定</button>
                    </div>
                ) : (
                    <div className="trip-config-display">
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>旅程名稱</p>
                            <p style={{ fontWeight: 700 }}>{config.tripName}</p>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>主要地點</p>
                            <p style={{ fontWeight: 700 }}>{config.location}</p>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>全域搜尋前綴 (Google Maps)</p>
                            <p style={{ fontWeight: 700 }}>{config.defaultRegion || <span style={{ color: '#ccc', fontWeight: 'normal' }}>無設定</span>}</p>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>日期區間</p>
                            <p style={{ fontWeight: 700 }}>{config.startDate} ~ {config.endDate}</p>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>同行人數</p>
                            <p style={{ fontWeight: 700 }}>{config.travelers || 1} 人</p>
                        </div>
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '20px' }}>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>旅行幣值</p>
                                <p style={{ fontWeight: 700 }}>{config.tripCurrency || 'JPY'}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>結算幣值</p>
                                <p style={{ fontWeight: 700 }}>{config.baseCurrency || 'TWD'}</p>
                            </div>
                        </div>
                        <button className="btn-edit" style={{ width: '100%' }} onClick={handleEditTripConfig}>編輯旅程</button>
                    </div>
                )}
            </div>

            <h3 className="section-title"><MapPin className="inline-icon" size={20} /> 我的住宿清單</h3>
            <div className="desktop-grid" style={{ display: 'grid', gap: '16px' }}>
                {(config.accommodations || []).length === 0 && !showAddAcc && (
                    <div className="empty-state" style={{ padding: '20px' }}>
                        尚未新增任何住宿
                    </div>
                )}

                {(config.accommodations || []).map(acc => (
                    <div key={acc.id} className="address-card" style={{ padding: '16px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--fuji-blue)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                                {acc.name}
                                {acc.checkIn && acc.checkOut && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 400, backgroundColor: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px', color: 'var(--fuji-blue)' }}>
                                        {acc.checkIn.slice(5)} ~ {acc.checkOut.slice(5)}
                                    </span>
                                )}
                            </h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleEditAcc(acc)} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px' }}>
                                    <Edit3 size={18} />
                                </button>
                                <button onClick={() => handleDeleteAcc(acc.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '4px' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="address-display" style={{ marginBottom: acc.url ? '12px' : 0 }}>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapIcon size={16} /> {acc.address}</p>
                        </div>
                        {acc.url && (
                            <a href={acc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--fuji-blue)', textDecoration: 'none', marginTop: '8px' }}>
                                <Link size={16} /> 訂房確認/官網連結
                            </a>
                        )}
                    </div>
                ))}

                {showAddAcc ? (
                    <div className="address-card fade-in" style={{ padding: '20px', border: '2px solid var(--fuji-blue-light)' }}>
                        <h4 style={{ fontSize: '1.05rem', marginBottom: '16px', color: 'var(--fuji-blue)' }}>
                            {editingAccId ? '編輯住宿' : '新增住宿'}
                        </h4>
                        <div className="form-group">
                            <label>住宿名稱 (如: 札幌格蘭大酒店)</label>
                            <input
                                type="text"
                                value={tempAcc.name || ''}
                                onChange={e => setTempAcc({ ...tempAcc, name: e.target.value })}
                                placeholder="輸入飯店或民宿名稱"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>地圖位址 (建議輸入全名便於查詢)</label>
                            <input
                                type="text"
                                value={tempAcc.address || ''}
                                onChange={e => setTempAcc({ ...tempAcc, address: e.target.value })}
                                placeholder="例如: 札幌市中央區大通西1丁目"
                            />
                        </div>
                        <div className="form-group">
                            <label>訂房連結 / 備註網址 (選填)</label>
                            <input
                                type="url"
                                value={tempAcc.url || ''}
                                onChange={e => setTempAcc({ ...tempAcc, url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
                            <div style={{ flex: 1 }}>
                                <label>入住日期 (Check-in)</label>
                                <input
                                    type="date"
                                    value={tempAcc.checkIn || ''}
                                    onChange={e => setTempAcc({ ...tempAcc, checkIn: e.target.value })}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>退房日期 (Check-out)</label>
                                <input
                                    type="date"
                                    value={tempAcc.checkOut || ''}
                                    min={tempAcc.checkIn || ''}
                                    onChange={e => setTempAcc({ ...tempAcc, checkOut: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button className="btn-cancel" onClick={() => setShowAddAcc(false)}>取消</button>
                            <button className="btn-submit" onClick={handleSaveAcc}>儲存</button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="btn-add-attraction"
                        style={{ width: '100%', padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}
                        onClick={handleAddAcc}
                    >
                        <Plus size={20} /> 新增更多住宿
                    </button>
                )}
            </div>

            <div className="quick-actions">
                <button className="action-btn" onClick={() => executeSearch('超市')}>
                    <ShoppingCart size={24} />
                    <span>超市</span>
                </button>
                <button className="action-btn" onClick={() => executeSearch('洗衣店')}>
                    <Search size={24} />
                    <span>洗衣店</span>
                </button>
                <button className="action-btn" onClick={() => executeSearch('餐廳')}>
                    <Coffee size={24} />
                    <span>飯堂</span>
                </button>
                <button className="action-btn" onClick={() => executeSearch('澡堂 錢湯')}>
                    <Search size={24} />
                    <span>澡堂</span>
                </button>
            </div>

            <h3 className="section-title" style={{ marginTop: '24px' }}><Share2 className="inline-icon" size={20} /> 與朋友共用行程</h3>
            <div className="address-card" style={{ padding: '16px' }}>
                <div style={{ backgroundColor: 'rgba(52, 88, 153, 0.05)', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(52, 88, 153, 0.1)' }}>
                    <h4 style={{ fontSize: '0.95rem', color: 'var(--fuji-blue)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💡 行程共用說明書
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.6 }}>
                        <p style={{ margin: '0 0 6px', color: 'var(--text-main)' }}><b>【如果您是主揪 (分享給別人)】</b></p>
                        <ol style={{ paddingLeft: '20px', margin: '0 0 16px', color: 'var(--text-light)' }}>
                            <li>點擊下方「產生行程分享碼」。</li>
                            <li>系統會自動加密您的行程，並<b>複製一串亂碼</b>到剪貼簿。</li>
                            <li>將這串亂碼透過 LINE 傳給朋友。</li>
                        </ol>
                        <p style={{ margin: '0 0 6px', color: 'var(--text-main)' }}><b>【如果您是團員 (接收別人的行程)】</b></p>
                        <ol style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-light)' }}>
                            <li>請在您的手機打開本 APP 網頁。</li>
                            <li><b>請先在首頁點擊「建立新的行程」</b>打底 (日期地點隨便填)。</li>
                            <li>進入後切換到這個「設定」頁面。</li>
                            <li>點擊下方「接收並匯入朋友的行程」。</li>
                            <li>貼上朋友傳給您的那串亂碼，瞬間無痛複製完成！🎉</li>
                        </ol>
                    </div>
                </div>
                <button
                    className="btn-add-attraction"
                    style={{ padding: '12px', marginTop: 0, marginBottom: '12px' }}
                    onClick={handleExport}
                >
                    <Share2 size={16} style={{ display: 'inline', marginRight: '6px' }} /> 產生行程分享碼 (給朋友)
                </button>

                {showImport ? (
                    <div style={{ marginTop: '12px' }}>
                        <textarea
                            placeholder="請在此貼上朋友傳給您的行程分享碼"
                            value={importCode}
                            onChange={e => setImportCode(e.target.value)}
                            style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button className="btn-save" style={{ flex: '1 1 120px' }} onClick={handleImport}>確認匯入</button>
                            <button className="btn-cancel" style={{ flex: '1 1 120px' }} onClick={() => setShowImport(false)}>取消</button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="btn-edit"
                        style={{ width: '100%' }}
                        onClick={() => setShowImport(true)}
                    >
                        <Download size={16} style={{ display: 'inline', marginRight: '6px' }} /> 接收並匯入朋友的行程
                    </button>
                )}
            </div>

            <h3 className="section-title" style={{ marginTop: '24px' }}>🌸 即時季節情報</h3>
            <div className="address-card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                    由於各國氣象系統不同，請點擊下方按鈕查詢「{config.location}」的最新網路預報。
                </p>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button
                        className="btn-add-attraction"
                        style={{ padding: '12px', marginTop: 0 }}
                        onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${config.location} 花期 櫻花預測 楓葉情報`)}`, '_blank')}
                    >
                        🔍 搜尋 Google 季節花期情報
                    </button>
                    <button
                        className="btn-add-attraction"
                        style={{ padding: '12px', marginTop: 0, backgroundColor: 'rgba(52, 88, 153, 0.1)', borderColor: 'transparent' }}
                        onClick={() => window.open(`https://tenki.jp/search/?keyword=${encodeURIComponent(config.location)}`, '_blank')}
                    >
                        ☀️ 查詢 tenki.jp 日本氣象
                    </button>
                </div>
            </div>

            <h3 className="section-title" style={{ marginTop: '24px' }}><Users className="inline-icon" size={20} /> 旅伴定位設定捷徑</h3>
            <div className="address-card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '12px', lineHeight: 1.5 }}>
                    為了這幾天的安全與方便，建議全團在「出發前」先統一設定好互相定位。原生 APP 會比網頁省電非常多喔！
                </p>
                <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button
                        className="btn-add-attraction"
                        style={{ padding: '12px', marginTop: 0, justifyContent: 'flex-start' }}
                        onClick={() => window.open('https://support.google.com/maps/answer/7326816?hl=zh-Hant&co=GENIE.Platform%3DiOS', '_blank')}
                    >
                        <MapIcon size={18} /> Google Maps 位置資訊分享 (推薦)
                    </button>
                    <button
                        className="btn-add-attraction"
                        style={{ padding: '12px', marginTop: 0, backgroundColor: 'rgba(52, 88, 153, 0.1)', borderColor: 'transparent', justifyContent: 'flex-start' }}
                        onClick={() => window.location.href = 'findmy://'}
                    >
                        <Navigation size={18} /> iPhone 內建「尋找」App
                    </button>
                    <button
                        className="btn-add-attraction"
                        style={{ padding: '12px', marginTop: 0, backgroundColor: 'rgba(52, 88, 153, 0.1)', borderColor: 'transparent', justifyContent: 'flex-start' }}
                        onClick={() => window.open('https://apps.apple.com/tw/app/whoo-a-location-sharing-app/id1661152011', '_blank')}
                    >
                        <Users size={18} /> Whoo 冰友 (Zenly 替代品)
                    </button>
                </div>
            </div>

            {/* DEBUG BLOCK FOR PWA CACHE */}
            <div className="address-card" style={{ padding: '16px', marginTop: '24px', backgroundColor: '#fff', border: '1px solid #ffccc7' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#cf1322', marginBottom: '8px' }}>
                    🛠️ 系統除錯區 (v1.2 多住宿日期版)
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '12px' }}>
                    如果您沒有看到「入住/退房日期」的新介面，代表您的手機開啟了網頁快取。請點擊下方按鈕強制清除快取並更新：
                </p>
                <button
                    onClick={() => {
                        window.location.href = window.location.pathname + '?v=' + new Date().getTime();
                    }}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#cf1322',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    強制清除快取 (修復畫面沒更新)
                </button>
            </div>
        </div>
    );
}
