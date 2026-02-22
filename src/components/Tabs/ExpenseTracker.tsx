import { useState } from 'react';
import { Plus, Receipt, Trash2, CalendarDays, Wallet, BadgeDollarSign } from 'lucide-react';
import { useExpenseStore, type ExpenseCategory } from '../../hooks/useExpenseStore';
import { useConfigStore } from '../../hooks/useConfigStore';
import { useExchangeRate } from '../../hooks/useExchangeRate';

// Helper to get currency symbol
const getCurrencySymbol = (currency: string) => {
    switch (currency) {
        case 'JPY': return '¥';
        case 'TWD': return 'NT$';
        case 'USD': return '$';
        case 'EUR': return '€';
        case 'KRW': return '₩';
        case 'THB': return '฿';
        case 'SGD': return 'S$';
        case 'HKD': return 'HK$';
        case 'MYR': return 'RM';
        default: return currency + ' ';
    }
};

export function ExpenseTracker({ tripId }: { tripId: string }) {
    const { expenses, loading, addExpense, removeExpense } = useExpenseStore(tripId);
    const { config } = useConfigStore(tripId);
    const { loading: ratesLoading, convert } = useExchangeRate();

    // Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [cat, setCat] = useState<ExpenseCategory>('飲食');
    const [dateTxt, setDateTxt] = useState(new Date().toISOString().split('T')[0]);
    const [payer, setPayer] = useState('自己');

    const categories: ExpenseCategory[] = ['飲食', '交通', '住宿', '購物', '門票', '其他'];

    if (loading || ratesLoading) return <div className="tab-placeholder fade-in">讀取帳本中...</div>;

    const travelers = config.travelers || 1;
    const tripCurr = config.tripCurrency || 'JPY';
    const baseCurr = config.baseCurrency || 'TWD';

    // Derived Statistics
    const totalSpentTripCurr = expenses.reduce((sum, e) => sum + e.amountJPY, 0); // Note: amountJPY in DB is actually amount in Trip Currency now
    const perPersonTripCurr = travelers > 1 ? Math.ceil(totalSpentTripCurr / travelers) : totalSpentTripCurr;

    // Convert to Base Currency
    const totalSpentBaseCurr = Math.round(convert(totalSpentTripCurr, tripCurr, baseCurr));
    const perPersonBaseCurr = travelers > 1 ? Math.ceil(totalSpentBaseCurr / travelers) : totalSpentBaseCurr;

    const handleSave = async () => {
        const val = parseInt(amount, 10);
        if (isNaN(val) || val <= 0) {
            alert('請輸入有效的金額');
            return;
        }
        if (!desc.trim()) {
            alert('請輸入花費描述');
            return;
        }

        await addExpense({
            amountJPY: val,
            description: desc.trim(),
            category: cat,
            dateISO: dateTxt,
            paidBy: payer.trim() || '自己'
        });

        // Reset
        setAmount('');
        setDesc('');
        setShowAddForm(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('確定要刪除這筆花費嗎？')) {
            removeExpense(id);
        }
    };

    return (
        <div className="expense-view fade-in">
            {/* Dashboard Headers */}
            <div style={{ backgroundColor: 'var(--fuji-blue)', color: 'white', padding: '24px 20px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 8px 16px rgba(52, 88, 153, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Wallet size={16} /> 本趟總花費 ({tripCurr})
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{getCurrencySymbol(tripCurr)} {totalSpentTripCurr.toLocaleString()}</span>
                        </div>
                        {tripCurr !== baseCurr && (
                            <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '4px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'inline-block', padding: '4px 8px', borderRadius: '8px' }}>
                                約 {getCurrencySymbol(baseCurr)} {totalSpentBaseCurr.toLocaleString()}
                            </p>
                        )}
                    </div>
                    {travelers > 1 && (
                        <div style={{ textAlign: 'right', backgroundColor: 'rgba(255,255,255,0.15)', padding: '10px 14px', borderRadius: '12px' }}>
                            <p style={{ opacity: 0.9, fontSize: '0.8rem', marginBottom: '2px' }}>{travelers} 人平分</p>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{getCurrencySymbol(tripCurr)} {perPersonTripCurr.toLocaleString()}</div>
                            {tripCurr !== baseCurr && (
                                <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '2px' }}>
                                    約 {getCurrencySymbol(baseCurr)} {perPersonBaseCurr.toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <button
                className="btn-submit fade-in"
                style={{ width: '100%', marginBottom: '24px', padding: '16px', borderRadius: '12px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => setShowAddForm(!showAddForm)}
            >
                {showAddForm ? <Trash2 size={20} /> : <Plus size={20} />}
                {showAddForm ? '取消新增' : '記一筆帳'}
            </button>

            {/* Add Record Form */}
            {showAddForm && (
                <div className="address-card fade-in" style={{ marginBottom: '24px', padding: '20px' }}>
                    <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Receipt size={20} className="icon-main" /> 新增花費紀錄
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>金額 ({tripCurr})</label>
                            <div style={{ position: 'relative' }}>
                                <BadgeDollarSign size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: '#999' }} />
                                <input
                                    type="number"
                                    min="0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                    style={{ width: '100%', padding: '10px 10px 10px 32px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1.1rem' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>日期</label>
                            <input
                                type="date"
                                value={dateTxt}
                                onChange={e => setDateTxt(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', height: '44px' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>項目描述</label>
                        <input
                            type="text"
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder="如：晚餐拉麵、免稅藥妝"
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>分類</label>
                            <select
                                value={cat}
                                onChange={e => setCat(e.target.value as ExpenseCategory)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', fontSize: '1rem', height: '44px' }}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '4px' }}>付款人 (分帳用)</label>
                            <input
                                type="text"
                                value={payer}
                                onChange={e => setPayer(e.target.value)}
                                placeholder="自己"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', height: '44px' }}
                            />
                        </div>
                    </div>

                    <button className="btn-save" style={{ width: '100%' }} onClick={handleSave}>儲存紀錄</button>
                </div>
            )}

            {/* List */}
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-main)' }}>支出明細</h3>
            {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)', backgroundColor: 'var(--snow-white)', borderRadius: '16px' }}>
                    <Receipt size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                    <p>目前還沒有任何花費紀錄</p>
                </div>
            ) : (
                <div className="desktop-grid" style={{ display: 'grid', gap: '12px' }}>
                    {expenses.map(exp => (
                        <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #eee' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: 'var(--snow-white)', color: 'var(--text-main)', borderRadius: '12px' }}>{exp.category}</span>
                                    <span style={{ fontSize: '0.85rem', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CalendarDays size={12} /> {exp.dateISO}
                                    </span>
                                </div>
                                <h4 style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{exp.description}</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>代墊: {exp.paidBy}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--fuji-blue)' }}>¥{exp.amountJPY.toLocaleString()}</div>
                                <button
                                    style={{ marginTop: '8px', background: 'none', border: 'none', color: '#ff6b6b', fontSize: '0.85rem', cursor: 'pointer' }}
                                    onClick={() => handleDelete(exp.id)}
                                >
                                    刪除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ height: '80px' }}></div>
        </div>
    );
}
