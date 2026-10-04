import { useState } from 'react';
import { Plus, BaggageClaim, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useChecklistStore, type PackingCategory, type PackingItem } from '../../hooks/useChecklistStore';
import { useConfigStore } from '../../hooks/useConfigStore';
import { CustomsPanel } from '../CustomsPanel';
import { useUi } from '../ui/uiContext';

const CATEGORIES: PackingCategory[] = ['重要文件', '電子產品', '衣物', '盥洗用品', '其他'];

export function PackingChecklist({ tripId }: { tripId: string }) {
    const { items, loading, error, addItem, togglePacked, removeItem } = useChecklistStore(tripId);
    const { config } = useConfigStore(tripId);
    const ui = useUi();

    const [text, setText] = useState('');
    const [cat, setCat] = useState<PackingCategory>('其他');

    if (loading) return <div className="loading" role="status">讀取清單中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;

    const total = items.length;
    const packed = items.filter((i) => i.isPacked).length;
    const pct = total === 0 ? 0 : Math.round((packed / total) * 100);

    const handleAdd = async () => {
        if (!text.trim()) return;
        const ok = await ui.run(() => addItem({ text: text.trim(), category: cat }), '新增失敗');
        if (ok) setText('');
    };

    const grouped = CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)] as [PackingCategory, PackingItem[]]).filter(([, l]) => l.length > 0);

    return (
        <div className="tab-panel">
            <CustomsPanel location={config.location} />

            <section className="progress-card" aria-label="行李準備進度">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="section-title" style={{ margin: 0 }}>
                        <BaggageClaim size={22} aria-hidden="true" /> 行李準備進度
                    </h2>
                    <strong style={{ fontFamily: 'var(--serif)', fontSize: '1.2rem' }}>
                        {packed} / {total}
                    </strong>
                </div>
                <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="已打包比例">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
            </section>

            <form
                className="add-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdd();
                }}
            >
                <select className="select" value={cat} onChange={(e) => setCat(e.target.value as PackingCategory)} aria-label="分類">
                    {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                    ))}
                </select>
                <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="輸入要帶的物品" aria-label="物品名稱" />
                <button type="submit" className="btn btn-primary" aria-label="新增物品">
                    <Plus size={20} aria-hidden="true" /> 新增
                </button>
            </form>

            {grouped.length === 0 && <div className="empty-state">清單是空的，在上面新增要帶的東西吧。</div>}

            <div className="stack-lg">
                {grouped.map(([c, list]) => (
                    <section key={c}>
                        <h3 className="section-title" style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: '0 0 8px 4px' }}>
                            {c}
                        </h3>
                        <ul className="check-group">
                            {list.map((item) => (
                                <li key={item.id} className="check-row">
                                    <button type="button" className="check-toggle" role="checkbox" aria-checked={item.isPacked} onClick={() => void ui.run(() => togglePacked(item.id), '更新失敗')}>
                                        <span className="box">{item.isPacked ? <CheckCircle2 size={24} aria-hidden="true" /> : <Circle size={24} aria-hidden="true" />}</span>
                                        <span className="text">{item.text}</span>
                                    </button>
                                    <button type="button" className="btn-icon danger" onClick={() => void ui.run(() => removeItem(item.id), '刪除失敗')} aria-label={`刪除：${item.text}`}>
                                        <Trash2 size={18} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
