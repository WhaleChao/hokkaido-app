import { useState } from 'react';
import { MapPin, Plus, Edit3, Trash2, Link as LinkIcon, ShoppingCart, Search, Coffee } from 'lucide-react';
import { type AppConfig, type Accommodation } from '../../data/config';
import { normalizeHttpUrl, mapsSearchUrl, openExternal } from '../../utils/url';
import { useUi } from '../ui/uiContext';
import { todayISO } from '../../utils/date';
import { pickAccommodation } from '../../utils/accommodation';

interface Props {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => Promise<void>;
}

type Draft = Partial<Accommodation>;

export function AccommodationCard({ config, updateConfig }: Props) {
    const ui = useUi();
    const accs = config.accommodations ?? [];
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<Draft>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const openForm = (acc?: Accommodation) => {
        setDraft(acc ? { ...acc } : { name: '', address: '', url: '', checkIn: config.startDate, checkOut: config.endDate });
        setEditingId(acc?.id ?? null);
        setErrors({});
        setAdding(true);
    };

    const save = async () => {
        const next: Record<string, string> = {};
        if (!draft.name?.trim()) next.name = '請輸入住宿名稱';
        if (!draft.address?.trim()) next.address = '請輸入地址或地圖上搜得到的名稱';
        let url = '';
        if (draft.url?.trim()) {
            const n = normalizeHttpUrl(draft.url);
            if (!n) next.url = '這不是有效的網址（需以 https:// 開頭）';
            else url = n;
        }
        if (draft.checkIn && draft.checkOut && draft.checkOut < draft.checkIn) next.dates = '退房日不能早於入住日';
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        const item: Accommodation = {
            id: editingId ?? crypto.randomUUID(),
            name: draft.name!.trim(),
            address: draft.address!.trim(),
            url,
            checkIn: draft.checkIn || undefined,
            checkOut: draft.checkOut || undefined,
        };
        const list = editingId ? accs.map((a) => (a.id === editingId ? item : a)) : [...accs, item];
        if (await ui.run(() => updateConfig({ accommodations: list }), '儲存住宿失敗', '已儲存住宿')) {
            setAdding(false);
            setEditingId(null);
        }
    };

    const remove = async (acc: Accommodation) => {
        const ok = await ui.confirm({ title: '刪除這個住宿？', message: `「${acc.name}」會從清單移除。`, confirmText: '刪除', danger: true });
        if (ok) await ui.run(() => updateConfig({ accommodations: accs.filter((a) => a.id !== acc.id) }), '刪除住宿失敗');
    };

    const searchNearby = (q: string) => {
        const acc = pickAccommodation(accs, todayISO());
        if (!acc) {
            ui.toast('請先在上方新增住宿，才能搜尋住宿附近', 'error');
            return;
        }
        openExternal(mapsSearchUrl(`${q} near ${acc.address}`));
    };

    return (
        <section aria-labelledby="acc-title">
            <h2 className="section-title" id="acc-title">
                <MapPin size={20} aria-hidden="true" /> 住宿與附近資訊
            </h2>
            <div className="stack">
                {accs.length === 0 && !adding && <div className="empty-state">尚未新增住宿</div>}
                {accs.map((acc) => (
                    <div key={acc.id} className="acc-card">
                        <div className="acc-head">
                            <div style={{ minWidth: 0 }}>
                                <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.05rem' }}>{acc.name}</h3>
                                {acc.checkIn && acc.checkOut && (
                                    <span className="chip chip-brass">
                                        {acc.checkIn.slice(5)} ～ {acc.checkOut.slice(5)}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex' }}>
                                <button type="button" className="btn-icon" onClick={() => openForm(acc)} aria-label={`編輯住宿：${acc.name}`}>
                                    <Edit3 size={18} aria-hidden="true" />
                                </button>
                                <button type="button" className="btn-icon danger" onClick={() => void remove(acc)} aria-label={`刪除住宿：${acc.name}`}>
                                    <Trash2 size={18} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <p className="small muted" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
                            {acc.address}
                        </p>
                        {acc.url && (
                            <a href={acc.url} target="_blank" rel="noopener noreferrer" className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, minHeight: 'var(--tap)' }}>
                                <LinkIcon size={16} aria-hidden="true" /> 訂房確認或官網
                            </a>
                        )}
                    </div>
                ))}

                {adding ? (
                    <form
                        className="card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save();
                        }}
                        noValidate
                        aria-label={editingId ? '編輯住宿' : '新增住宿'}
                    >
                        <label className="field">
                            <span className="label">住宿名稱</span>
                            <input className="input" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={!!errors.name} data-autofocus />
                            {errors.name && (
                                <p className="field-error" role="alert">
                                    {errors.name}
                                </p>
                            )}
                        </label>
                        <label className="field">
                            <span className="label">地址（Google 地圖搜得到的完整名稱最好）</span>
                            <input className="input" value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} aria-invalid={!!errors.address} />
                            {errors.address && (
                                <p className="field-error" role="alert">
                                    {errors.address}
                                </p>
                            )}
                        </label>
                        <label className="field">
                            <span className="label">訂房或官網連結（選填）</span>
                            <input className="input" inputMode="url" value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" aria-invalid={!!errors.url} />
                            {errors.url && (
                                <p className="field-error" role="alert">
                                    {errors.url}
                                </p>
                            )}
                        </label>
                        <div className="field-row">
                            <label className="field">
                                <span className="label">入住日</span>
                                <input className="input" type="date" value={draft.checkIn ?? ''} onChange={(e) => setDraft({ ...draft, checkIn: e.target.value })} />
                            </label>
                            <label className="field">
                                <span className="label">退房日</span>
                                <input className="input" type="date" value={draft.checkOut ?? ''} min={draft.checkIn || undefined} onChange={(e) => setDraft({ ...draft, checkOut: e.target.value })} />
                            </label>
                        </div>
                        {errors.dates && (
                            <p className="field-error" role="alert">
                                {errors.dates}
                            </p>
                        )}
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setAdding(false)}>
                                取消
                            </button>
                            <button type="submit" className="btn btn-primary">
                                儲存
                            </button>
                        </div>
                    </form>
                ) : (
                    <button type="button" className="btn-dashed" onClick={() => openForm()}>
                        <Plus size={20} aria-hidden="true" /> 新增住宿
                    </button>
                )}
            </div>

            <h3 className="section-title" style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                搜尋住宿附近
            </h3>
            <div className="quick-actions">
                <button type="button" className="action-btn" onClick={() => searchNearby('超市')}>
                    <ShoppingCart size={22} aria-hidden="true" />
                    超市
                </button>
                <button type="button" className="action-btn" onClick={() => searchNearby('投幣式洗衣店')}>
                    <Search size={22} aria-hidden="true" />
                    洗衣店
                </button>
                <button type="button" className="action-btn" onClick={() => searchNearby('餐廳')}>
                    <Coffee size={22} aria-hidden="true" />
                    餐廳
                </button>
                <button type="button" className="action-btn" onClick={() => searchNearby('錢湯 大眾澡堂')}>
                    <Search size={22} aria-hidden="true" />
                    澡堂
                </button>
            </div>
        </section>
    );
}
