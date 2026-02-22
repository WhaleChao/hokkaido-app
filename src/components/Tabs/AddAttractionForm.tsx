import { useState, useEffect, useRef } from 'react';
import { type Attraction, type Category, type Tag, type TimeSlot, type TransitDetails } from '../../data/itinerary';

interface Props {
    onSave: (attraction: Attraction) => void;
    onCancel: () => void;
    editAttraction?: Attraction;
    onAutoSave?: (attraction: Attraction) => void;
}

export function AddAttractionForm({ onSave, onCancel, editAttraction, onAutoSave }: Props) {
    const [name, setName] = useState(editAttraction?.name || '');
    const [category, setCategory] = useState<Category>(editAttraction?.category || '景點');
    const [description, setDescription] = useState(editAttraction?.description || '');
    const [mapQuery, setMapQuery] = useState(editAttraction?.mapQuery || '');

    // Existing Time & Duration
    const [timeSlot, setTimeSlot] = useState<TimeSlot>(editAttraction?.timeSlot || '無');
    const [isBackup, setIsBackup] = useState(editAttraction?.isBackup || false);
    const [durationMinutes, setDurationMinutes] = useState<number>(editAttraction?.durationMinutes || 60);

    // New Fields (Phase 14)
    const [startTime, setStartTime] = useState(editAttraction?.startTime || '');
    const [planVariant, setPlanVariant] = useState<string>(editAttraction?.planVariant || '');
    const [transitDetails, setTransitDetails] = useState<TransitDetails>(editAttraction?.transitDetails || {});
    const [selectedTags, setSelectedTags] = useState<Tag[]>(editAttraction?.tags || []);

    // --- Auto Save Logic for Inline Editing ---
    useEffect(() => {
        if (!editAttraction || !onAutoSave) return;
        if (!name.trim()) return;

        const payload: Attraction = {
            id: editAttraction.id,
            name,
            category,
            description,
            mapQuery: mapQuery || name,
            tags: selectedTags,
            timeSlot: timeSlot === '無' ? undefined : timeSlot,
            durationMinutes,
            isBackup,
            startTime: startTime || undefined,
            planVariant: planVariant || undefined,
            transitDetails: category === '交通' ? transitDetails : undefined
        };

        return () => {
            // Only auto-save on unmount (e.g., when switching tabs or closing the form)
            if (payload.name.trim()) {
                onAutoSave(payload);
            }
        };
    }, []); // Empty dependency array means this runs once on mount, and the return function runs ONCE on unmount.

    // We need a ref to access the *latest* state values inside the unmount closure
    const currentPayload = useRef<Attraction | null>(null);

    useEffect(() => {
        if (!editAttraction) return;
        currentPayload.current = {
            id: editAttraction.id,
            name,
            category,
            description,
            mapQuery: mapQuery || name,
            tags: selectedTags,
            timeSlot: timeSlot === '無' ? undefined : timeSlot,
            durationMinutes,
            isBackup,
            startTime: startTime || undefined,
            planVariant: planVariant || undefined,
            transitDetails: category === '交通' ? transitDetails : undefined
        };
    }, [name, category, description, mapQuery, selectedTags, timeSlot, durationMinutes, isBackup, startTime, planVariant, transitDetails, editAttraction]);

    useEffect(() => {
        return () => {
            if (onAutoSave && currentPayload.current && currentPayload.current.name.trim()) {
                onAutoSave(currentPayload.current);
            }
        };
    }, [onAutoSave]);
    // ------------------------------------------


    const categories: Category[] = ['食物', '活動', '購物', '景點', '酒店', '交通'];
    const timeSlots: TimeSlot[] = ['無', '早餐', '午餐', '晚餐'];
    const possibleTags: Tag[] = ['必吃', '必買', '必拍', '正選', '備選'];
    const durationOptions = [
        { label: '30 分鐘', value: 30 },
        { label: '1 小時', value: 60 },
        { label: '1.5 小時', value: 90 },
        { label: '2 小時', value: 120 },
        { label: '3 小時', value: 180 },
        { label: '半天 (4小時)', value: 240 },
        { label: '全天 (8小時)', value: 480 }
    ];

    const toggleTag = (tag: Tag) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleSave = () => {
        if (!name) {
            alert('請填寫名稱！');
            return;
        }

        const payload: Attraction = {
            id: editAttraction?.id || crypto.randomUUID(),
            name,
            category,
            description,
            mapQuery: mapQuery || name,
            tags: selectedTags,
            timeSlot: timeSlot === '無' ? undefined : timeSlot,
            durationMinutes,
            isBackup,
            startTime: startTime || undefined,
            planVariant: planVariant || undefined,
            transitDetails: category === '交通' ? transitDetails : undefined
        };

        onSave(payload);
    };

    return (
        <div className="add-attraction-form fade-in">
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {editAttraction ? '✏️ 編輯行程' : '新增景點'}
                {editAttraction && <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-light)', backgroundColor: 'var(--bg-color)', padding: '4px 8px', borderRadius: '12px' }}>進入編輯模式</span>}
            </h3>

            <div className="form-group">
                <label>景點名稱</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：小樽運河"
                />
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div>
                    <label>分類</label>
                    <select value={category} onChange={e => setCategory(e.target.value as Category)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginTop: '4px' }}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div>
                    <label>預計停留時間</label>
                    <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginTop: '4px' }}
                    >
                        {durationOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div>
                    <label>特定時間 (選填)</label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginTop: '4px', fontFamily: 'inherit' }}
                    />
                </div>
                <div>
                    <label>方案分類標籤 (選填)</label>
                    <input
                        type="text"
                        value={planVariant}
                        onChange={e => setPlanVariant(e.target.value)}
                        placeholder="例如: A、B、雨天..."
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginTop: '4px' }}
                    />
                </div>
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div>
                    <label>用餐時段 (選填)</label>
                    <select value={timeSlot} onChange={e => setTimeSlot(e.target.value as TimeSlot)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', marginTop: '4px' }}>
                        {timeSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label>備案標記</label>
                    <label style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '8px', cursor: 'pointer', fontWeight: 'normal' }}>
                        <input
                            type="checkbox"
                            checked={isBackup}
                            onChange={e => setIsBackup(e.target.checked)}
                            style={{ width: 'auto', marginBottom: 0 }}
                        />
                        這是一個備選方案
                    </label>
                </div>
            </div>

            {category === '交通' && (
                <div style={{ backgroundColor: 'rgba(52, 88, 153, 0.05)', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(52, 88, 153, 0.1)' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--fuji-blue)', marginBottom: '12px' }}>🚇 轉乘細節設定</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#666' }}>路線 (Line)</label>
                            <input type="text" value={transitDetails.line || ''} onChange={e => setTransitDetails({ ...transitDetails, line: e.target.value })} placeholder="例如: 富士急行線" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#666' }}>月台 (Platform)</label>
                            <input type="text" value={transitDetails.platform || ''} onChange={e => setTransitDetails({ ...transitDetails, platform: e.target.value })} placeholder="例如: 1番線" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#666' }}>出口 (Exit)</label>
                            <input type="text" value={transitDetails.exit || ''} onChange={e => setTransitDetails({ ...transitDetails, exit: e.target.value })} placeholder="例如: 東口" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: '#666' }}>車資 (Fare)</label>
                            <input type="text" value={transitDetails.cost || ''} onChange={e => setTransitDetails({ ...transitDetails, cost: e.target.value })} placeholder="例如: 1140円" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }} />
                        </div>
                    </div>
                </div>
            )}

            <div className="form-group">
                <label>描述</label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="輸入關於這個景點的筆記..."
                />
            </div>

            <div className="form-group">
                <label>Google Maps 搜尋關鍵字 (選填)</label>
                <input
                    type="text"
                    value={mapQuery}
                    onChange={e => setMapQuery(e.target.value)}
                    placeholder="例如: Sapporo Odori Park"
                />
            </div>

            <div className="form-group">
                <label>標籤</label>
                <div className="tag-selector">
                    {possibleTags.map(tag => (
                        <button
                            key={tag}
                            className={`tag-toggle ${selectedTags.includes(tag) ? 'active' : ''}`}
                            onClick={() => toggleTag(tag)}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-actions">
                <button className="btn-cancel" onClick={onCancel}>取消</button>
                <button className="btn-submit" onClick={handleSave}>儲存景點</button>
            </div>
        </div>
    );
}
