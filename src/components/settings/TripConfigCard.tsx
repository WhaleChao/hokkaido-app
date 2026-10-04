import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { type AppConfig, visibleLocation } from '../../data/config';
import { CURRENCIES, currencyName } from '../../utils/money';
import { validateTripDates, tripDayCount } from '../../utils/date';
import { DateField } from '../ui/DateField';
import { formatYMD } from '../../utils/date';
import { useUi } from '../ui/uiContext';

interface Props {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => Promise<void>;
}

export function TripConfigCard({ config, updateConfig }: Props) {
    const ui = useUi();
    const [editing, setEditing] = useState(false);
    const [f, setF] = useState(config);
    const [travelers, setTravelers] = useState(String(config.travelers || 1));
    const [errors, setErrors] = useState<Record<string, string>>({});

    const start = () => {
        setF(config);
        setTravelers(String(config.travelers || 1));
        setErrors({});
        setEditing(true);
    };

    const save = async () => {
        const next: Record<string, string> = {};
        if (!f.tripName.trim()) next.tripName = '請輸入旅程名稱';
        const dateProblem = validateTripDates(f.startDate, f.endDate);
        if (dateProblem) next.dates = dateProblem;
        const n = Number(travelers);
        if (!Number.isInteger(n) || n < 1 || n > 99) next.travelers = '人數請填 1 到 99 的整數';
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        const before = tripDayCount(config.startDate, config.endDate);
        const after = tripDayCount(f.startDate, f.endDate);
        if (before !== null && after !== null && after < before) {
            const ok = await ui.confirm({
                title: '縮短旅程天數？',
                message: `旅程會從 ${before} 天變成 ${after} 天。後面幾天的行程會先隱藏（資料不會被刪除，把結束日改回來就會再出現）。`,
                confirmText: '縮短',
            });
            if (!ok) return;
        }
        const saved = await ui.run(
            () =>
                updateConfig({
                    tripName: f.tripName.trim(),
                    location: f.location.trim(),
                    defaultRegion: f.defaultRegion?.trim() ?? '',
                    startDate: f.startDate,
                    endDate: f.endDate,
                    travelers: n,
                    tripCurrency: f.tripCurrency,
                    baseCurrency: f.baseCurrency,
                }),
            '儲存設定失敗',
            '旅程設定已儲存',
        );
        if (saved) setEditing(false);
    };

    return (
        <section aria-labelledby="trip-config-title">
            <h2 className="section-title" id="trip-config-title">
                <SettingsIcon size={20} aria-hidden="true" /> 旅程設定
            </h2>
            <div className="card">
                {editing ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save();
                        }}
                        noValidate
                    >
                        <label className="field">
                            <span className="label">旅程名稱</span>
                            <input className="input" aria-label="旅程名稱" value={f.tripName} onChange={(e) => setF({ ...f, tripName: e.target.value })} aria-invalid={!!errors.tripName} data-autofocus />
                            {errors.tripName && (
                                <p className="field-error" role="alert">
                                    {errors.tripName}
                                </p>
                            )}
                        </label>
                        <label className="field">
                            <span className="label">主要地點（英文較準，用來查天氣）</span>
                            <input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="例如：Sapporo, Japan" />
                        </label>
                        <label className="field">
                            <span className="label">地圖搜尋前綴（選填）</span>
                            <input className="input" value={f.defaultRegion ?? ''} onChange={(e) => setF({ ...f, defaultRegion: e.target.value })} placeholder="例如：札幌" />
                            <span className="hint">導航時會自動加在景點名稱前面，避免 Google 地圖找到同名的別處。</span>
                        </label>
                        <div className="field-row">
                            <DateField label="出發日" value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />
                            <DateField label="結束日" value={f.endDate} min={f.startDate || undefined} onChange={(v) => setF({ ...f, endDate: v })} />
                        </div>
                        {errors.dates && (
                            <p className="field-error" role="alert">
                                {errors.dates}
                            </p>
                        )}
                        <label className="field">
                            <span className="label">同行人數（分帳用）</span>
                            <input className="input" inputMode="numeric" aria-label="同行人數（分帳用）" value={travelers} onChange={(e) => setTravelers(e.target.value)} aria-invalid={!!errors.travelers} />
                            {errors.travelers && (
                                <p className="field-error" role="alert">
                                    {errors.travelers}
                                </p>
                            )}
                        </label>
                        <div className="field-row">
                            <label className="field">
                                <span className="label">當地幣別</span>
                                <select className="select" aria-label="當地幣別" value={f.tripCurrency} onChange={(e) => setF({ ...f, tripCurrency: e.target.value })}>
                                    {CURRENCIES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="field">
                                <span className="label">結算幣別</span>
                                <select className="select" aria-label="結算幣別" value={f.baseCurrency} onChange={(e) => setF({ ...f, baseCurrency: e.target.value })}>
                                    {CURRENCIES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {f.tripCurrency !== config.tripCurrency && <p className="hint">更換當地幣別後，新記的帳會用新幣別；舊的紀錄仍保留當時的幣別。</p>}
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                                取消
                            </button>
                            <button type="submit" className="btn btn-primary">
                                儲存設定
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <dl className="kv">
                            <div>
                                <dt>旅程名稱</dt>
                                <dd>{config.tripName}</dd>
                            </div>
                            <div>
                                <dt>主要地點</dt>
                                <dd>{visibleLocation(config.location) || <span className="muted">尚未設定（設定後才有天氣與海關提醒）</span>}</dd>
                            </div>
                            <div>
                                <dt>地圖搜尋前綴</dt>
                                <dd>{config.defaultRegion || <span className="muted">未設定</span>}</dd>
                            </div>
                            <div>
                                <dt>日期</dt>
                                <dd>
                                    {formatYMD(config.startDate)} ～ {formatYMD(config.endDate)}
                                </dd>
                            </div>
                            <div>
                                <dt>同行人數</dt>
                                <dd>{config.travelers || 1} 人</dd>
                            </div>
                            <div>
                                <dt>幣別</dt>
                                <dd>
                                    {currencyName(config.tripCurrency ?? 'JPY')} → {currencyName(config.baseCurrency ?? 'TWD')}
                                </dd>
                            </div>
                        </dl>
                        <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 16 }} onClick={start}>
                            編輯旅程
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}
