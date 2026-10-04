import { useState, useMemo } from 'react';
import { Plus, Receipt, CalendarDays, Wallet, AlertTriangle, Download } from 'lucide-react';
import { useExpenseStore, type ExpenseCategory, type ExpenseRecord } from '../../hooks/useExpenseStore';
import { useConfigStore } from '../../hooks/useConfigStore';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { useUi } from '../ui/uiContext';
import { todayISO, isValidISODate, formatYMD } from '../../utils/date';
import { parseAmount, formatMoney, splitEvenly, fractionDigits, roundTo, currencyName } from '../../utils/money';
import { DateField } from '../ui/DateField';
import { saveFile } from '../../utils/download';
import { expensesToCsv } from '../../utils/csv';
import { totalIn } from '../../utils/expenses';

const CATEGORIES: ExpenseCategory[] = ['飲食', '交通', '住宿', '購物', '門票', '其他'];

export function ExpenseTracker({ tripId }: { tripId: string }) {
    const { expenses, loading, error, addExpense, updateExpense, removeExpense } = useExpenseStore(tripId);
    const { config } = useConfigStore(tripId);
    const { convert, status, fetchedAt, loading: ratesLoading } = useExchangeRates();
    const ui = useUi();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formCurrency, setFormCurrency] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [cat, setCat] = useState<ExpenseCategory>('飲食');
    const [dateTxt, setDateTxt] = useState(() => todayISO());
    const [payer, setPayer] = useState('自己');
    const [errors, setErrors] = useState<{ amount?: string; desc?: string; date?: string }>({});

    const travelers = config.travelers || 1;
    const tripCurr = config.tripCurrency || 'JPY';
    const baseCurr = config.baseCurrency || 'TWD';

    const totals = useMemo(() => {
        const trip = totalIn(expenses, tripCurr, tripCurr, convert);
        const base = tripCurr === baseCurr ? trip : totalIn(expenses, tripCurr, baseCurr, convert);
        const byPayer = new Map<string, number>();
        for (const e of expenses) {
            const v = (e.currency || tripCurr) === tripCurr ? e.amountJPY : convert(e.amountJPY, e.currency || tripCurr, tripCurr);
            if (v !== null) byPayer.set(e.paidBy, (byPayer.get(e.paidBy) ?? 0) + v);
        }
        return { trip, base, byPayer };
    }, [expenses, tripCurr, baseCurr, convert]);

    if (loading) return <div className="loading" role="status">讀取記帳資料中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;

    const sameCurr = tripCurr === baseCurr;
    const perTrip = travelers > 1 ? splitEvenly(totals.trip.value, travelers, tripCurr) : totals.trip.value;
    const perBase = travelers > 1 ? splitEvenly(totals.base.value, travelers, baseCurr) : totals.base.value;
    const ratesNote =
        sameCurr || (expenses.length === 0)
            ? null
            : status === 'unavailable'
              ? '目前沒有匯率資料（可能沒網路），暫時無法換算。連上網路後會自動補上。'
              : status === 'stale-cache'
                ? `使用 ${new Date(fetchedAt ?? 0).toLocaleString('zh-TW')} 存下的匯率換算，可能已過時。`
                : null;

    const handleSave = async () => {
        const next: typeof errors = {};
        const cur = formCurrency ?? tripCurr;
        const val = parseAmount(amount, cur);
        if (val === null) {
            next.amount = fractionDigits(cur) === 0 ? `請輸入大於 0 的整數金額（${currencyName(cur)}沒有小數）` : '請輸入大於 0 的金額，最多兩位小數';
        }
        if (!desc.trim()) next.desc = '請輸入這筆花費的說明';
        if (!isValidISODate(dateTxt)) next.date = '請選擇日期';
        setErrors(next);
        if (Object.keys(next).length > 0 || val === null) return;

        const data = { amountJPY: val, currency: cur, description: desc.trim(), category: cat, dateISO: dateTxt, paidBy: payer.trim() || '自己' };
        const ok = await ui.run(() => (editingId ? updateExpense(editingId, data) : addExpense(data)), '儲存失敗', editingId ? '已更新這筆花費' : '已記下這筆花費');
        if (ok) closeForm();
    };

    const closeForm = () => {
        setAmount('');
        setDesc('');
        setErrors({});
        setEditingId(null);
        setFormCurrency(null);
        setShowForm(false);
    };

    const startEdit = (e: ExpenseRecord) => {
        setEditingId(e.id);
        setFormCurrency(e.currency || tripCurr);
        setAmount(String(e.amountJPY));
        setDesc(e.description);
        setCat(e.category);
        setDateTxt(e.dateISO);
        setPayer(e.paidBy);
        setErrors({});
        setShowForm(true);
    };

    const handleExport = async () => {
        const csv = expensesToCsv(expenses, tripCurr);
        const name = `記帳_${config.tripName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || '旅程'}_${todayISO().replace(/-/g, '')}.csv`;
        await ui.run(async () => {
            const file = new File([new Blob([csv], { type: 'text/csv;charset=utf-8' })], name, { type: 'text/csv' });
            await saveFile(file);
        }, '匯出失敗', '已匯出記帳資料（CSV，可用 Excel 或試算表開啟）');
    };

    const handleDelete = async (e: ExpenseRecord) => {
        const ok = await ui.confirm({ title: '刪除這筆花費？', message: `${e.description}（${formatMoney(e.amountJPY, e.currency || tripCurr)}）`, confirmText: '刪除', danger: true });
        if (ok) await ui.run(() => removeExpense(e.id), '刪除失敗');
    };

    return (
        <div className="tab-panel">
            <section className="summary-card" aria-label="花費總覽">
                <p className="label-line">
                    <Wallet size={16} aria-hidden="true" /> 本趟總花費（{currencyName(tripCurr)}）
                </p>
                <p className="big">{formatMoney(totals.trip.value, tripCurr)}</p>
                {!sameCurr && expenses.length > 0 && (
                    <p className="sub">
                        {totals.base.incomplete
                            ? ratesLoading
                                ? '換算中…'
                                : totals.base.converted === 0
                                  ? `暫時無法換算成${currencyName(baseCurr)}（沒有匯率）`
                                  : `約 ${formatMoney(totals.base.value, baseCurr)}（另有幾筆未能換算，實際會更多）`
                            : `約 ${formatMoney(totals.base.value, baseCurr)}`}
                    </p>
                )}
                {travelers > 1 && (
                    <div className="summary-split">
                        <span>{travelers} 人平分，每人約</span>
                        <span>
                            <strong>{formatMoney(perTrip, tripCurr)}</strong>
                            {!sameCurr && !totals.base.incomplete && expenses.length > 0 && <span style={{ display: 'block', textAlign: 'right', opacity: 0.85 }}>約 {formatMoney(perBase, baseCurr)}</span>}
                        </span>
                    </div>
                )}
                {totals.byPayer.size > 1 && (
                    <div className="payer-list" aria-label="各人代墊小計">
                        {[...totals.byPayer.entries()].map(([name, v]) => (
                            <div key={name}>
                                <span>{name} 代墊</span>
                                <span>{formatMoney(roundTo(v, fractionDigits(tripCurr)), tripCurr)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {ratesNote && (
                <div className="notice notice-warn" role="status" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>{ratesNote}</span>
                </div>
            )}

            {!showForm ? (
                <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 52 }} onClick={() => {
                        setDateTxt(todayISO());
                        setEditingId(null);
                        setFormCurrency(null);
                        setShowForm(true);
                    }}>
                    <Plus size={20} aria-hidden="true" /> 記一筆花費
                </button>
            ) : (
                <form
                    className="card"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSave();
                    }}
                    aria-label={editingId ? '編輯花費' : '新增花費'}
                    noValidate
                >
                    <h3 className="section-title" style={{ margin: '0 0 12px' }}>
                        <Receipt size={20} aria-hidden="true" /> {editingId ? '編輯花費' : '新增花費'}
                    </h3>
                    <div className="field-row">
                        <label className="field">
                            <span className="label">金額（{currencyName(formCurrency ?? tripCurr)}）</span>
                            <input className="input" inputMode="decimal" aria-label={`金額（${currencyName(formCurrency ?? tripCurr)}）`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-invalid={!!errors.amount} data-autofocus />
                            {errors.amount && (
                                <p className="field-error" role="alert">
                                    {errors.amount}
                                </p>
                            )}
                        </label>
                        <DateField label="日期" value={dateTxt} onChange={setDateTxt} error={errors.date} />
                    </div>
                    <label className="field">
                        <span className="label">說明</span>
                        <input className="input" aria-label="說明" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="例如：晚餐拉麵、藥妝店" aria-invalid={!!errors.desc} />
                        {errors.desc && (
                            <p className="field-error" role="alert">
                                {errors.desc}
                            </p>
                        )}
                    </label>
                    <div className="field-row">
                        <label className="field">
                            <span className="label">分類</span>
                            <select className="select" aria-label="分類" value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)}>
                                {CATEGORIES.map((c) => (
                                    <option key={c}>{c}</option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span className="label">誰先付的（分帳用）</span>
                            <input className="input" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="自己" />
                        </label>
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={closeForm}>
                            取消
                        </button>
                        <button type="submit" className="btn btn-primary">
                            儲存
                        </button>
                    </div>
                </form>
            )}

            <h3 className="section-title">花費明細</h3>
            {expenses.length === 0 ? (
                <div className="empty-state">
                    <Receipt size={36} aria-hidden="true" />
                    <p>還沒有任何花費紀錄</p>
                </div>
            ) : (
                <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => void handleExport()}>
                        <Download size={16} aria-hidden="true" /> 匯出 CSV
                    </button>
                </div>
                <ul className="expense-grid">
                    {expenses.map((e) => (
                        <li key={e.id} className="expense-row">
                            <div style={{ minWidth: 0 }}>
                                <div className="chip-group" style={{ marginBottom: 4 }}>
                                    <span className="chip">{e.category}</span>
                                    <span className="small muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <CalendarDays size={13} aria-hidden="true" /> {formatYMD(e.dateISO)}
                                    </span>
                                </div>
                                <p style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{e.description}</p>
                                <p className="small muted">{e.paidBy} 先付</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p className="expense-amount">{formatMoney(e.amountJPY, e.currency || tripCurr)}</p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginRight: -12 }}>
<button type="button" className="btn btn-ghost" onClick={() => startEdit(e)} aria-label={`編輯：${e.description}`}>
                                    編輯
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', minHeight: 'var(--tap)' }} onClick={() => void handleDelete(e)} aria-label={`刪除：${e.description}`}>
                                    刪除
                                </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
                </>
            )}
        </div>
    );
}


