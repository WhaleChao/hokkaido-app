import { useState } from 'react';
import { useConfigStore } from '../../hooks/useConfigStore';
import { useExchangeRates } from '../../hooks/useExchangeRates';
import { Calculator, RefreshCw, ArrowDownUp, AlertTriangle } from 'lucide-react';
import { fractionDigits, displayDigits, currencyName } from '../../utils/money';

const QUICK_TRIP = [100, 500, 1000, 5000, 10000];
const QUICK_BASE = [100, 500, 1000, 2000, 5000];

function fmt(n: number, currency: string): string {
    const d = displayDigits(currency);
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function ExchangeRate({ tripId }: { tripId: string }) {
    const { config } = useConfigStore(tripId);
    const { convert, status, fetchedAt, error, loading, refresh } = useExchangeRates();
    const [tripToBase, setTripToBase] = useState(true);
    const [input, setInput] = useState('1000');

    const baseCurr = config.baseCurrency || 'TWD';
    const tripCurr = config.tripCurrency || 'JPY';
    const from = tripToBase ? tripCurr : baseCurr;
    const to = tripToBase ? baseCurr : tripCurr;

    const unit = convert(1, tripCurr, baseCurr); // 1 旅行幣 = ? 結算幣
    const n = Number(input.replace(/,/g, ''));
    const valid = input.trim() !== '' && Number.isFinite(n) && n >= 0;
    const out = valid ? convert(n, from, to) : null;

    const swap = () => {
        // 換方向時把目前的結果帶過去，數字才接得起來
        if (out !== null && valid) setInput(String(Number(out.toFixed(fractionDigits(to)))));
        setTripToBase(!tripToBase);
    };

    const stale = status === 'stale-cache';
    const none = status === 'unavailable';

    return (
        <div className="tab-panel">
            <h2 className="section-title">
                <Calculator size={22} aria-hidden="true" /> 匯率計算機
            </h2>

            {none && (
                <div className="notice notice-error" role="alert" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>
                        <strong>目前拿不到匯率</strong>
                        {error ? `${error}。` : ''}請確認網路連線後按「更新」。沒有匯率時不會顯示任何估算數字，以免誤導。
                    </span>
                </div>
            )}
            {stale && (
                <div className="notice notice-warn" role="status" style={{ marginBottom: 12 }}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>
                        <strong>目前使用舊匯率</strong>
                        無法連線更新（{error}），以下使用 {new Date(fetchedAt ?? 0).toLocaleString('zh-TW')} 存下的匯率。
                    </span>
                </div>
            )}

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className="small muted">
                        1 {currencyName(tripCurr)} ≈ {unit === null ? '—' : unit.toFixed(4)} {currencyName(baseCurr)}
                        <br />
                        {fetchedAt ? `匯率時間：${new Date(fetchedAt).toLocaleString('zh-TW')}` : '尚未取得匯率'}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => void refresh()} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" /> 更新
                    </button>
                </div>

                <label className="exchange-box" style={{ display: 'block' }}>
                    <span className="small muted">金額（{currencyName(from)}）</span>
                    <input type="text" inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} aria-invalid={!valid} placeholder="0" />
                </label>
                {!valid && (
                    <p className="field-error" role="alert">
                        請輸入數字
                    </p>
                )}
                <div className="swap-wrap">
                    <button type="button" className="swap-btn" onClick={swap} aria-label={`對調方向，目前是${currencyName(from)}換成${currencyName(to)}`}>
                        <ArrowDownUp size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="exchange-box out" aria-live="polite">
                    <span className="small" style={{ opacity: 0.8 }}>
                        換算約為（{currencyName(to)}）
                    </span>
                    <div className="big">{out === null ? '—' : fmt(out, to)}</div>
                </div>
            </div>

            <h3 className="section-title">
                常用金額（{currencyName(tripCurr)} → {currencyName(baseCurr)}）
            </h3>
            <div className="quick-grid">
                {(tripCurr === 'JPY' || tripCurr === 'KRW' || tripCurr === 'VND' ? QUICK_TRIP : QUICK_BASE).map((amt) => {
                    const v = convert(amt, tripCurr, baseCurr);
                    return (
                        <div key={amt} className="quick-cell">
                            <div className="a">
                                {amt.toLocaleString('en-US')} <span className="small muted">{currencyName(tripCurr)}</span>
                            </div>
                            <div className="b">
                                {v === null ? '—' : fmt(v, baseCurr)} <span className="small muted">{currencyName(baseCurr)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="small muted" style={{ textAlign: 'center', marginTop: 28 }}>
                匯率來自{' '}
                <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
                    ExchangeRate-API
                </a>
                （每日更新的參考匯率）。實際刷卡或換匯的匯率與手續費，以銀行或店家為準。
            </p>
        </div>
    );
}
