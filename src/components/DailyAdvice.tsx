import { useState, useEffect } from 'react';
import { Info, CloudRain, Sun, Cloud, Snowflake } from 'lucide-react';
import { type DailyAdvice as DailyAdviceType } from '../data/itinerary';
import { fetchWeather, type WeatherData } from '../utils/weather';
import { useConfigStore } from '../hooks/useConfigStore';

interface Props {
    tripId: string;
    advice: DailyAdviceType; // Fallback static advice
    dayIndex: number;
}

export function DailyAdvice({ tripId, advice, dayIndex }: Props) {
    const { config } = useConfigStore(tripId);
    const [liveWeather, setLiveWeather] = useState<WeatherData | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);

    useEffect(() => {
        if (!config.location || !config.startDate) return;

        const loadWeather = async () => {
            setLoadingWeather(true);
            const startDateObj = new Date(config.startDate);
            startDateObj.setDate(startDateObj.getDate() + dayIndex);
            // Format YYYY-MM-DD
            const targetDateStr = startDateObj.toISOString().split('T')[0];

            try {
                const data = await fetchWeather(config.location, targetDateStr);
                setLiveWeather(data);
            } catch (e) {
                console.error("Open-Meteo failure", e);
            } finally {
                setLoadingWeather(false);
            }
        };

        loadWeather();
    }, [config.location, config.startDate, dayIndex]);

    const getWeatherIcon = (code: number) => {
        // WMO Weather interpretation codes
        if (code === 0 || code === 1) return <Sun size={20} className="inline-icon" color="#ffb020" />;
        if (code === 2 || code === 3) return <Cloud size={20} className="inline-icon" color="#9aa0a6" />;
        if (code >= 50 && code <= 67) return <CloudRain size={20} className="inline-icon" color="#345899" />;
        if (code >= 71 && code <= 77) return <Snowflake size={20} className="inline-icon" color="#71a8f5" />;
        if (code >= 80) return <CloudRain size={20} className="inline-icon" color="#345899" />;
        return <Cloud size={20} className="inline-icon" color="#9aa0a6" />;
    };

    return (
        <div className="daily-advice">
            <h4 className="advice-title">
                <Info size={16} className="advice-icon" /> 每日智慧叮嚀
            </h4>
            <div className="advice-content">
                {liveWeather ? (
                    <div className="live-weather-box" style={{ marginBottom: '10px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 'bold' }}>
                            {getWeatherIcon(liveWeather.weatherCode)}
                            <span>預估氣溫：{liveWeather.minTemp}°C ~ {liveWeather.maxTemp}°C</span>
                        </div>
                    </div>
                ) : loadingWeather ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '10px' }}>擷取全球雲端氣象資料中...</p>
                ) : (
                    <div className="live-weather-box" style={{ marginBottom: '10px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#666' }}>
                            <Info size={16} className="inline-icon" />
                            <span style={{ fontSize: '0.85rem' }}>即時氣象將於出發前 7 日解鎖</span>
                        </div>
                    </div>
                )}

                <p><strong>自動穿著建議：</strong>{liveWeather ? liveWeather.advice : "由於距離行程大於七天，請隨時留意當地季節均溫變化，行前一週會自動切換為即時穿搭警報！"}</p>
                <p><strong>雪況與備註：</strong>{advice.snowCondition}</p>
            </div>
        </div>
    );
}
