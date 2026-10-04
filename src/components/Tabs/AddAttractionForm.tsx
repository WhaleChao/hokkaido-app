import { useState } from 'react';
import { type Attraction, type Category, type Tag, type TimeSlot, type TransitDetails } from '../../data/itinerary';
import clsx from 'clsx';

interface Props {
    onSave: (attraction: Attraction) => void;
    onCancel: () => void;
    editAttraction?: Attraction;
}

const CATEGORIES: Category[] = ['食物', '活動', '購物', '景點', '酒店', '交通'];
const TIME_SLOTS: TimeSlot[] = ['無', '早餐', '午餐', '晚餐'];
const POSSIBLE_TAGS: Tag[] = ['必吃', '必買', '必拍', '正選', '備選'];
const DURATIONS = [
    { label: '30 分鐘', value: 30 },
    { label: '1 小時', value: 60 },
    { label: '1.5 小時', value: 90 },
    { label: '2 小時', value: 120 },
    { label: '3 小時', value: 180 },
    { label: '半天（4 小時）', value: 240 },
    { label: '全天（8 小時）', value: 480 },
];

/** 編輯與新增共用。只有按「儲存」才會寫入；按「取消」就是真的取消，不會偷偷存檔。 */
export function AddAttractionForm({ onSave, onCancel, editAttraction }: Props) {
    const [name, setName] = useState(editAttraction?.name || '');
    const [category, setCategory] = useState<Category>(editAttraction?.category || '景點');
    const [description, setDescription] = useState(editAttraction?.description || '');
    const [mapQuery, setMapQuery] = useState(editAttraction?.mapQuery || '');
    const [timeSlot, setTimeSlot] = useState<TimeSlot>(editAttraction?.timeSlot || '無');
    const [isBackup, setIsBackup] = useState(editAttraction?.isBackup || false);
    // 沒有設定過停留時間的舊景點，編輯時保持「不指定」，不要硬塞 60 分鐘
    const [durationMinutes, setDurationMinutes] = useState<number>(editAttraction ? (editAttraction.durationMinutes ?? 0) : 60);
    const [startTime, setStartTime] = useState(editAttraction?.startTime || '');
    const [planVariant, setPlanVariant] = useState<string>(editAttraction?.planVariant || '');
    const [transit, setTransit] = useState<TransitDetails>(editAttraction?.transitDetails || {});
    const [tags, setTags] = useState<Tag[]>(editAttraction?.tags || []);
    const [error, setError] = useState('');

    const toggleTag = (tag: Tag) => setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

    const handleSave = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('請填寫景點名稱');
            return;
        }
        const payload: Attraction = {
            ...(editAttraction ?? {}), // 保留表單沒有的欄位（停車資訊、拍照提示、多選項…），編輯時不會被洗掉
            id: editAttraction?.id || crypto.randomUUID(),
            name: trimmed,
            category,
            description,
            mapQuery: mapQuery.trim() || trimmed,
            tags,
            timeSlot: timeSlot === '無' ? undefined : timeSlot,
            durationMinutes: durationMinutes > 0 ? durationMinutes : undefined,
            isBackup,
            startTime: startTime || undefined,
            planVariant: planVariant.trim() || undefined,
            transitDetails: category === '交通' ? transit : undefined,
        };
        onSave(payload);
    };

    const durationOptions = DURATIONS.some((d) => d.value === durationMinutes) || durationMinutes === 0 ? DURATIONS : [...DURATIONS, { label: `${durationMinutes} 分鐘`, value: durationMinutes }];

    return (
        <form
            className="add-attraction-form"
            onSubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
            aria-label={editAttraction ? '編輯景點' : '新增景點'}
        >
            <h3 className="section-title" style={{ margin: '0 0 12px' }}>
                {editAttraction ? '編輯景點' : '新增景點'}
            </h3>

            <label className="field">
                <span className="label">景點名稱</span>
                <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：小樽運河" aria-invalid={!!error} data-autofocus />
                {error && (
                    <p className="field-error" role="alert">
                        {error}
                    </p>
                )}
            </label>

            <div className="field-row">
                <label className="field">
                    <span className="label">分類</span>
                    <select className="select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                        {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    <span className="label">預計停留時間</span>
                    <select className="select" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
                        <option value={0}>不指定</option>
                        {durationOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="field-row">
                <label className="field">
                    <span className="label">指定時間（選填）</span>
                    <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </label>
                <label className="field">
                    <span className="label">方案標籤（選填）</span>
                    <input className="input" type="text" value={planVariant} onChange={(e) => setPlanVariant(e.target.value)} placeholder="例如：A、B、雨天" />
                </label>
            </div>

            <div className="field-row">
                <label className="field">
                    <span className="label">用餐時段（選填）</span>
                    <select className="select" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}>
                        {TIME_SLOTS.map((s) => (
                            <option key={s}>{s}</option>
                        ))}
                    </select>
                </label>
                <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 'var(--tap)', alignSelf: 'end' }}>
                    <input type="checkbox" checked={isBackup} onChange={(e) => setIsBackup(e.target.checked)} style={{ width: 22, height: 22 }} />
                    <span>這是備選方案</span>
                </label>
            </div>

            {category === '交通' && (
                <fieldset className="card" style={{ marginTop: 14 }}>
                    <legend className="label" style={{ padding: '0 6px' }}>
                        轉乘細節
                    </legend>
                    <div className="field-row">
                        <label className="field">
                            <span className="label">路線</span>
                            <input className="input" value={transit.line || ''} onChange={(e) => setTransit({ ...transit, line: e.target.value })} placeholder="例如：富士急行線" />
                        </label>
                        <label className="field">
                            <span className="label">月台</span>
                            <input className="input" value={transit.platform || ''} onChange={(e) => setTransit({ ...transit, platform: e.target.value })} placeholder="例如：1 番線" />
                        </label>
                        <label className="field">
                            <span className="label">出口</span>
                            <input className="input" value={transit.exit || ''} onChange={(e) => setTransit({ ...transit, exit: e.target.value })} placeholder="例如：東口" />
                        </label>
                        <label className="field">
                            <span className="label">車資</span>
                            <input className="input" value={transit.cost || ''} onChange={(e) => setTransit({ ...transit, cost: e.target.value })} placeholder="例如：1140 円" />
                        </label>
                    </div>
                </fieldset>
            )}

            <label className="field">
                <span className="label">說明與筆記</span>
                <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="營業時間、要點的餐點、預約資訊…" />
            </label>

            <label className="field">
                <span className="label">Google 地圖搜尋字（選填，留空就用名稱）</span>
                <input className="input" value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="例如：Sapporo Odori Park" />
            </label>

            <div className="field">
                <span className="label">標籤</span>
                <div className="chip-group" role="group" aria-label="標籤">
                    {POSSIBLE_TAGS.map((tag) => (
                        <button key={tag} type="button" className={clsx('toggle-chip', tags.includes(tag) && 'active')} aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    取消
                </button>
                <button type="submit" className="btn btn-primary">
                    儲存
                </button>
            </div>
        </form>
    );
}
