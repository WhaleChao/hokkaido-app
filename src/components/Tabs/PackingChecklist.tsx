import { useState, useEffect } from 'react';
import { Plus, BaggageClaim, AlertTriangle, X, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useChecklistStore, type PackingCategory, type PackingItem } from '../../hooks/useChecklistStore';
import { useConfigStore } from '../../hooks/useConfigStore';
import { configStore } from '../../db';

interface ProhibitedRule {
    keywords: string[];
    message: string;
}

interface RulesData {
    rules: ProhibitedRule[];
    last_updated: string;
}

export function PackingChecklist({ tripId }: { tripId: string }) {
    const { items, loading, addItem, togglePacked, removeItem } = useChecklistStore(tripId);
    const { config } = useConfigStore(tripId);

    // Form State
    const [newItemText, setNewItemText] = useState('');
    const [newItemCat, setNewItemCat] = useState<PackingCategory>('其他');
    const categories: PackingCategory[] = ['重要文件', '電子產品', '衣物', '盥洗用品', '其他'];

    // Phase 17: Prohibited Alert State
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const [alertDismissed, setAlertDismissed] = useState(false);

    useEffect(() => {
        if (!config.location || alertDismissed) return;

        const checkProhibitedItems = async () => {
            try {
                // 1. Try hitting the GitHub Raw URL directly for the absolute latest (auto-updating)
                // Fallback to local public/prohibited_rules.json if offline or developing
                const cacheKey = 'prohibited_rules_cache';
                let rulesData: RulesData | null = null;

                try {
                    const response = await fetch('https://raw.githubusercontent.com/whalechao/hokkaido-app/main/public/prohibited_rules.json');
                    if (response.ok) {
                        rulesData = await response.json();
                        await configStore.setItem(cacheKey, { data: rulesData, timestamp: Date.now() });
                    }
                } catch (e) {
                    console.warn('Could not fetch remote rules, falling back to cache or local.');
                }

                if (!rulesData) {
                    const cached = await configStore.getItem<{ data: RulesData, timestamp: number }>(cacheKey);
                    // 7-day TTL check
                    if (cached && (Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000)) {
                        rulesData = cached.data;
                    } else {
                        // Strict local fallback using Vite's BASE_URL
                        const res = await fetch(`${import.meta.env.BASE_URL}prohibited_rules.json`);
                        if (res.ok) rulesData = await res.json();
                    }
                }

                if (rulesData && rulesData.rules) {
                    const locationLower = config.location.toLowerCase();
                    const matchedRule = rulesData.rules.find(rule =>
                        rule.keywords.some(kw => locationLower.includes(kw.toLowerCase()))
                    );

                    if (matchedRule) {
                        setAlertMessage(matchedRule.message);
                    }
                }

            } catch (err) {
                console.error('Failed to load prohibited rules', err);
            }
        };

        checkProhibitedItems();
    }, [config.location, alertDismissed]);

    if (loading) return <div className="tab-placeholder fade-in">讀取清單中...</div>;

    const total = items.length;
    const packedCount = items.filter(i => i.isPacked).length;
    const progressPerc = total === 0 ? 0 : Math.round((packedCount / total) * 100);

    const handleAdd = async () => {
        if (!newItemText.trim()) return;
        await addItem({
            text: newItemText.trim(),
            category: newItemCat
        });
        setNewItemText('');
    };

    // Group items by category
    const groupedItems = categories.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {} as Record<PackingCategory, PackingItem[]>);

    return (
        <div className="checklist-view fade-in">
            {/* Phase 17: Dynamic Prohibited Item Warning */}
            {alertMessage && !alertDismissed && (
                <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #ffeeba', position: 'relative', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <AlertTriangle style={{ flexShrink: 0, marginTop: '2px' }} size={20} color="#856404" />
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px', fontSize: '1rem' }}>目的地海關規定警示</strong>
                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>{alertMessage}</p>
                    </div>
                    <button
                        onClick={() => setAlertDismissed(true)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#856404', padding: '4px' }}
                        title="我知道了"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Progress Header */}
            <div style={{ backgroundColor: 'white', padding: '24px 20px', borderRadius: '16px', marginBottom: '20px', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fuji-blue)' }}>
                        <BaggageClaim size={24} /> 行李準備進度
                    </h3>
                    <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {packedCount} / {total}
                    </span>
                </div>
                {/* Progress Bar Track */}
                <div style={{ width: '100%', height: '12px', backgroundColor: 'var(--snow-white)', borderRadius: '6px', overflow: 'hidden' }}>
                    {/* Fill */}
                    <div style={{ width: `${progressPerc}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.3s ease-out' }}></div>
                </div>
            </div>

            {/* Quick Add */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <select
                    value={newItemCat}
                    onChange={e => setNewItemCat(e.target.value as PackingCategory)}
                    style={{ flex: '1 1 100px', padding: '12px', borderRadius: '12px', border: '1px solid #ddd', background: 'white' }}
                >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                    type="text"
                    value={newItemText}
                    onChange={e => setNewItemText(e.target.value)}
                    placeholder="輸入新物品..."
                    style={{ flex: '2 1 140px', padding: '12px', borderRadius: '12px', border: '1px solid #ddd' }}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button
                    className="btn-add-checklist-item"
                    onClick={handleAdd}
                    style={{ flex: '0 0 auto', minWidth: '48px', backgroundColor: 'var(--fuji-blue)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* Render Categories */}
            <div className="desktop-grid" style={{ paddingBottom: '80px' }}>
                {categories.map(cat => {
                    const catItems = groupedItems[cat];
                    if (catItems.length === 0) return null;

                    return (
                        <div key={cat} style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '1rem', color: 'var(--text-light)', marginBottom: '12px', paddingLeft: '8px' }}>{cat}</h4>
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #eee', overflow: 'hidden' }}>
                                {catItems.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '16px',
                                            borderBottom: idx !== catItems.length - 1 ? '1px solid #f5f5f5' : 'none',
                                            backgroundColor: item.isPacked ? '#fafafa' : 'white',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <button
                                            onClick={() => togglePacked(item.id, item.isPacked)}
                                            style={{ background: 'none', border: 'none', padding: '0', marginRight: '16px', color: item.isPacked ? 'var(--accent-primary)' : '#ddd', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            {item.isPacked ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                        </button>

                                        <span style={{
                                            flex: 1,
                                            fontSize: '1.05rem',
                                            color: item.isPacked ? '#999' : 'var(--text-main)',
                                            textDecoration: item.isPacked ? 'line-through' : 'none',
                                            transition: 'all 0.2s'
                                        }}>
                                            {item.text}
                                        </span>

                                        <button
                                            onClick={() => removeItem(item.id)}
                                            style={{ background: 'none', border: 'none', color: '#ff6b6b', opacity: 0.6, cursor: 'pointer', padding: '4px' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
