import { useState, useEffect } from 'react';
import { useConfigStore } from '../../hooks/useConfigStore';
import { Calculator, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { configStore } from '../../db';

interface ExchangeData {
    base_code: string;
    rates: Record<string, number>;
    time_last_update_unix: number;
}

export function ExchangeRate({ tripId }: { tripId: string }) {
    const { config } = useConfigStore(tripId);
    const [rate, setRate] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Swap mode: If true, Input = Base Currency, Output = Trip Currency
    // If false, Input = Trip Currency, Output = Base Currency
    const [isTripToBase, setIsTripToBase] = useState(true);
    const [inputValue, setInputValue] = useState<string>('1000');

    const baseCurr = config.baseCurrency || 'TWD';
    const tripCurr = config.tripCurrency || 'JPY';

    const fetchRate = async (forceRefresh = false) => {
        setLoading(true);
        setError('');
        try {
            const cacheKey = `exchange_${tripCurr}_to_${baseCurr}`;
            if (!forceRefresh) {
                const cached = await configStore.getItem<ExchangeData>(cacheKey);
                if (cached && (Date.now() / 1000 - cached.time_last_update_unix) < 86400) {
                    if (cached.rates[baseCurr]) {
                        // Exchangerate-api base is usually the TripCurrency if we request it,
                        // e.g. https://open.er-api.com/v6/latest/JPY
                        setRate(cached.rates[baseCurr]);
                        setLastUpdate(new Date(cached.time_last_update_unix * 1000));
                        setLoading(false);
                        return;
                    }
                }
            }

            const response = await fetch(`https://open.er-api.com/v6/latest/${tripCurr}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data: ExchangeData = await response.json();

            if (data.rates && data.rates[baseCurr]) {
                setRate(data.rates[baseCurr]);
                setLastUpdate(new Date(data.time_last_update_unix * 1000));
                await configStore.setItem(cacheKey, data);
            } else {
                throw new Error('Currency not found in response');
            }
        } catch (e: any) {
            console.error(e);
            setError('無法取得最新匯率，請檢查網路連線。如果先前有快取，仍可使用離線速算。');

            // Fallback to cache even if expired
            const cacheKey = `exchange_${tripCurr}_to_${baseCurr}`;
            const cached = await configStore.getItem<ExchangeData>(cacheKey);
            if (cached && cached.rates[baseCurr]) {
                setRate(cached.rates[baseCurr]);
                setLastUpdate(new Date(cached.time_last_update_unix * 1000));
            }

        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRate();
    }, [tripCurr, baseCurr]);

    const handleSwap = () => {
        setIsTripToBase(!isTripToBase);
        // Recalculate input so the value matches what was on the other side
        if (rate && inputValue) {
            const val = parseFloat(inputValue);
            if (!isNaN(val)) {
                if (isTripToBase) {
                    setInputValue((val * rate).toFixed(2).replace(/\.00$/, ''));
                } else {
                    setInputValue((val / rate).toFixed(2).replace(/\.00$/, ''));
                }
            }
        }
    };

    const getConvertedValue = () => {
        if (!rate || !inputValue) return '0';
        const val = parseFloat(inputValue);
        if (isNaN(val)) return '0';

        if (isTripToBase) {
            return (val * rate).toFixed(2).replace(/\.00$/, '');
        } else {
            return (val / rate).toFixed(2).replace(/\.00$/, '');
        }
    };

    const inputLabel = isTripToBase ? tripCurr : baseCurr;
    const outputLabel = isTripToBase ? baseCurr : tripCurr;

    const quickAmounts = isTripToBase
        ? [100, 500, 1000, 5000, 10000] // Typical JPY/KRW/THB denominations
        : [100, 500, 1000, 2000, 5000]; // Typical TWD/USD denominations

    return (
        <div className="exchange-view fade-in" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
            <h2 className="section-title"><Calculator className="inline-icon" size={24} /> 匯率計算機</h2>

            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        基準匯率: 1 {tripCurr} = {rate ? rate.toFixed(4) : '...'} {baseCurr}
                        <br />
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                            {lastUpdate ? `最後更新: ${lastUpdate.toLocaleString()}` : '尚未更新'}
                        </span>
                    </div>
                    <button
                        onClick={() => fetchRate(true)}
                        disabled={loading}
                        style={{ padding: '8px 12px', borderRadius: '12px', border: '1px solid #eee', backgroundColor: 'var(--snow-white)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                    >
                        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                        更新
                    </button>
                </div>

                {error && <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: '8px' }}>{error}</div>}

                <div style={{ position: 'relative' }}>
                    {/* Input Block */}
                    <div style={{ padding: '16px', backgroundColor: 'var(--snow-white)', borderRadius: '16px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '8px' }}>金額 ({inputLabel})</div>
                        <input
                            type="number"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="0"
                            style={{
                                width: '100%',
                                fontSize: '2rem',
                                fontWeight: 700,
                                border: 'none',
                                backgroundColor: 'transparent',
                                outline: 'none',
                                color: 'var(--text-main)'
                            }}
                        />
                    </div>

                    {/* Swap Button */}
                    <button
                        onClick={handleSwap}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            border: '1px solid #eee',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 2
                        }}
                    >
                        <ArrowRightLeft size={18} color="var(--fuji-blue)" />
                    </button>

                    {/* Output Block */}
                    <div style={{ padding: '16px', backgroundColor: 'var(--fuji-blue)', borderRadius: '16px', color: 'white' }}>
                        <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '8px' }}>換算約為 ({outputLabel})</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, wordBreak: 'break-all' }}>
                            {getConvertedValue()}
                        </div>
                    </div>
                </div>
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>常見金額速算表 ({tripCurr} ➡️ {baseCurr})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {quickAmounts.map(amt => (
                    <div key={amt} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{amt} <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 400 }}>{tripCurr}</span></div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--sage-green)' }}>
                            {rate ? (amt * rate).toFixed(0) : '...'} <span style={{ fontSize: '0.8rem', opacity: 0.8, fontWeight: 400 }}>{baseCurr}</span>
                        </div>
                    </div>
                ))}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', textAlign: 'center', marginTop: '32px' }}>
                匯率資料來源: Open Exchange Rates API<br />此數值僅供參考，實際刷卡匯率以發卡銀行為準。
            </p>
        </div>
    );
}
