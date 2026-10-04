import { useState, useEffect } from 'react';
import { Info, CloudRain, Sun, Cloud, Snowflake, CloudFog, Zap, Lightbulb } from 'lucide-react';
import { type DailyAdvice as DailyAdviceType } from '../data/itinerary';
import { fetchWeather, type WeatherStatus, type WeatherKind } from '../utils/weather';
import { useConfigStore } from '../hooks/useConfigStore';
import { addDaysISO, todayISO } from '../utils/date';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Props {
    tripId: string;
    advice: DailyAdviceType;
    dayIndex: number;
}

// 舊版自動建立每天資料時寫入的占位字，不是使用者寫的內容，不顯示。
const PLACEHOLDERS = new Set(['等待即時天氣預報...', '請確保填寫正確的目的地與出發日期以獲取建議。']);
const real = (s: string | undefined) => (s && !PLACEHOLDERS.has(s.trim()) ? s.trim() : '');

const KIND_LABEL: Record<WeatherKind, string> = { clear: '晴', cloudy: '多雲', fog: '霧', rain: '雨', snow: '雪', storm: '雷雨' };

function WeatherIcon({ kind }: { kind: WeatherKind }) {
    const p = { size: 20, 'aria-hidden': true as const };
    if (kind === 'clear') return <Sun {...p} />;
    if (kind === 'cloudy') return <Cloud {...p} />;
    if (kind === 'fog') return <CloudFog {...p} />;
    if (kind === 'rain') return <CloudRain {...p} />;
    if (kind === 'snow') return <Snowflake {...p} />;
    return <Zap {...p} />;
}

function statusMessage(s: WeatherStatus, location: string, past: boolean): string {
    switch (s.state) {
        case 'no-location':
            return '到「設定」填寫主要地點，就能看到當天的天氣與穿著建議。';
        case 'location-not-found':
            return `找不到「${location}」的天氣資料。請到「設定」把主要地點改成常見的英文名稱，例如 Sapporo, Japan。`;
        case 'out-of-range':
            return past ? '這一天已經過了，不再顯示預報。' : '天氣預報只提供未來 16 天，出發前兩週內再回來看。';
        case 'offline':
            return '目前沒有網路，而且這個地點還沒有存過預報。連上網路後會自動更新。';
        case 'error':
            return `天氣服務暫時無法使用（${s.message}）。稍後會自動重試。`;
        default:
            return '';
    }
}

export function DailyAdvice({ tripId, advice, dayIndex }: Props) {
    const { config } = useConfigStore(tripId);
    const online = useOnlineStatus();
    const dateISO = addDaysISO(config.startDate, dayIndex);
    const key = `${config.location}|${dateISO}|${online}`;
    const [result, setResult] = useState<{ key: string; status: WeatherStatus } | null>(null);

    useEffect(() => {
        if (!dateISO) return;
        let cancelled = false;
        void fetchWeather(config.location, dateISO).then((status) => {
            if (!cancelled) setResult({ key, status });
        });
        return () => {
            cancelled = true;
        };
    }, [config.location, dateISO, key]);

    const status: WeatherStatus | null = !dateISO ? { state: 'no-location' } : result && result.key === key ? result.status : null;
    const past = !!dateISO && dateISO < todayISO();
    const clothing = real(advice.clothing);
    const note = real(advice.snowCondition);

    return (
        <section className="daily-advice" aria-labelledby="advice-title">
            <h3 id="advice-title">
                <Lightbulb size={18} aria-hidden="true" /> 每日叮嚀
            </h3>

            {status === null ? (
                <div className="weather-box" role="status">
                    <Info size={18} aria-hidden="true" /> 讀取天氣中…
                </div>
            ) : status.state === 'ok' ? (
                <div className="weather-box">
                    <WeatherIcon kind={status.data.kind} />
                    <span>
                        {KIND_LABEL[status.data.kind]}，{status.data.minTemp}°C ~ {status.data.maxTemp}°C
                    </span>
                </div>
            ) : (
                <div className="weather-box" role="status">
                    <Info size={18} aria-hidden="true" />
                    <span style={{ fontWeight: 400, fontSize: '0.9rem' }}>{statusMessage(status, config.location, past)}</span>
                </div>
            )}

            {status?.state === 'ok' && (
                <p>
                    <strong>穿著建議：</strong>
                    {status.data.advice}
                </p>
            )}
            {clothing && (
                <p>
                    <strong>你的穿著備註：</strong>
                    {clothing}
                </p>
            )}
            {note && (
                <p>
                    <strong>雪況與備註：</strong>
                    {note}
                </p>
            )}
            {status?.state === 'ok' && (
                <p className="meta">
                    {status.stale ? `目前離線，顯示 ${new Date(status.fetchedAt).toLocaleString('zh-TW')} 存下的預報。` : '預報資料來源：'}
                    {!status.stale && (
                        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
                            Open-Meteo
                        </a>
                    )}
                </p>
            )}
        </section>
    );
}
