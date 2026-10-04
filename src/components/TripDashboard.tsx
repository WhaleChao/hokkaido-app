import { useEffect, useState } from 'react';
import { Plus, Map, Trash2, CalendarDays, ChevronRight } from 'lucide-react';
import { useTripManager } from '../hooks/useTripManager';
import { readConfig, writeDays } from '../utils/tripData';
import { validateTripDates, tripDayCount, formatMD, formatYMD, addDaysISO, todayISO } from '../utils/date';
import { sampleDays } from '../data/itinerary';
import { patchConfig } from '../utils/tripData';
import { DateField } from './ui/DateField';
import { BackupButtons } from './BackupButtons';
import { useUi } from './ui/uiContext';
import { onData } from '../utils/bus';

const todayISOFrom = (ms: number) => todayISO(new Date(ms));

interface Props {
    manager: ReturnType<typeof useTripManager>;
}

function useTripSummaries(ids: string) {
    const [map, setMap] = useState<Record<string, string>>({});
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const out: Record<string, string> = {};
            for (const id of ids ? ids.split(',') : []) {
                const c = await readConfig(id).catch(() => null);
                if (c) {
                    const n = tripDayCount(c.startDate, c.endDate);
                    out[id] = n ? `${formatMD(c.startDate)} – ${formatMD(c.endDate)}・${n} 天` : '日期尚未設定';
                }
            }
            if (!cancelled) setMap(out);
        };
        void load();
        const off = onData('config', () => void load());
        return () => {
            cancelled = true;
            off();
        };
    }, [ids]);
    return map;
}

export function TripDashboard({ manager }: Props) {
    const { trips, loading, error, createTrip, selectTrip, deleteTrip } = manager;
    const ui = useUi();
    const [name, setName] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [creating, setCreating] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; dates?: string }>({});
    const summaries = useTripSummaries(trips.map((t) => t.id).join(','));

    if (loading) return <div className="loading" role="status">載入旅程庫中…</div>;

    const handleCreate = async () => {
        const next: typeof errors = {};
        if (!name.trim()) next.name = '請幫這趟旅程取個名字';
        const dateProblem = validateTripDates(start, end);
        if (dateProblem) next.dates = dateProblem;
        setErrors(next);
        if (Object.keys(next).length > 0) return;
        const id = await ui.run(() => createTrip(name.trim(), start, end), '建立旅程失敗');
        if (id) {
            setName('');
            setStart('');
            setEnd('');
            setCreating(false);
        }
    };

    const handleSample = async () => {
        const from = addDaysISO(todayISO(), 30) ?? todayISO();
        const to = addDaysISO(from, sampleDays.length - 1) ?? from;
        await ui.run(async () => {
            const id = await createTrip('北海道三日範例', from, to);
            await patchConfig(id, { location: 'Sapporo, Japan', defaultRegion: '北海道', startDate: from, endDate: to });
            const days = sampleDays.map((d, i) => ({ ...d, id: `day-${i + 1}`, dayLabel: `第 ${i + 1} 天`, attractions: d.attractions.map((a) => ({ ...a, id: `s${i + 1}-${a.id}` })) }));
            await writeDays(id, days, days.map((d) => d.id));
        }, '建立範例失敗');
    };

    const handleDelete = async (id: string, tripName: string) => {
        const ok = await ui.confirm({
            title: `刪除「${tripName}」？`,
            message: '這趟旅程的行程、記帳、行李清單、相簿連結與票券都會從這支手機永久刪除，無法復原。\n\n如果不確定，請先「下載完整備份」。',
            confirmText: '永久刪除',
            danger: true,
        });
        if (ok) await ui.run(() => deleteTrip(id), '刪除失敗', '已刪除旅程');
    };

    return (
        <main className="dashboard" id="main">
            <div style={{ textAlign: 'center' }}>
                <div className="brand-mark" aria-hidden="true">
                    <Map size={32} />
                </div>
                <h1>我的旅程庫</h1>
                <p className="lead">旅程、記帳與票券都存在這支手機，沒有網路也能用</p>
            </div>

            {error && (
                <div className="notice notice-error" role="alert" style={{ marginBottom: 16 }}>
                    <span>{error}</span>
                </div>
            )}

            {!creating ? (
                <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 52, marginBottom: 20 }} onClick={() => setCreating(true)}>
                    <Plus size={20} aria-hidden="true" /> 建立新旅程
                </button>
            ) : (
                <form
                    className="card"
                    style={{ marginBottom: 20 }}
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleCreate();
                    }}
                    noValidate
                    aria-label="建立新旅程"
                >
                    <h2 className="section-title" style={{ margin: '0 0 12px' }}>
                        為這趟旅程命名並選擇日期
                    </h2>
                    <label className="field">
                        <span className="label">旅程名稱</span>
                        <input className="input" aria-label="旅程名稱" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：2027 大阪吃到飽之旅" aria-invalid={!!errors.name} data-autofocus />
                        {errors.name && (
                            <p className="field-error" role="alert">
                                {errors.name}
                            </p>
                        )}
                    </label>
                    <div className="field-row">
                        <DateField label="出發日" value={start} onChange={setStart} />
                        <DateField label="結束日" value={end} min={start || undefined} onChange={setEnd} />
                    </div>
                    {errors.dates && (
                        <p className="field-error" role="alert">
                            {errors.dates}
                        </p>
                    )}
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>
                            取消
                        </button>
                        <button type="submit" className="btn btn-primary">
                            建立
                        </button>
                    </div>
                </form>
            )}

            <h2 className="section-title">已儲存的旅程（{trips.length}）</h2>
            {trips.length === 0 ? (
                <div className="empty-state">
                    <CalendarDays size={36} aria-hidden="true" />
                    <p>還沒有任何旅程</p>
                    <button type="button" className="btn btn-ghost" onClick={() => void handleSample()}>
                        先建立一份北海道範例看看
                    </button>
                </div>
            ) : (
                <ul className="trip-list">
                    {trips.map((t) => (
                        <li key={t.id} className="trip-card">
                            <button type="button" className="trip-open" onClick={() => void selectTrip(t.id)}>
                                <span className="trip-icon" aria-hidden="true">
                                    <CalendarDays size={22} />
                                </span>
                                <span style={{ minWidth: 0, flex: 1 }}>
                                    <span className="trip-name" style={{ display: 'block' }}>
                                        {t.name}
                                    </span>
                                    <span className="trip-meta">{summaries[t.id] ?? `建立於 ${formatYMD(todayISOFrom(t.createdAt))}`}</span>
                                </span>
                                <ChevronRight size={20} aria-hidden="true" className="muted" />
                                <span className="sr-only">開啟 {t.name}</span>
                            </button>
                            <button type="button" className="btn-icon danger" onClick={() => void handleDelete(t.id, t.name)} aria-label={`刪除旅程：${t.name}`}>
                                <Trash2 size={20} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="footer-tools">
                <h2 className="section-title" style={{ marginTop: 0 }}>
                    備份你的資料
                </h2>
                <BackupButtons />
            </div>
        </main>
    );
}
