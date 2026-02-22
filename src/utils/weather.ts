export interface WeatherData {
    minTemp: number;
    maxTemp: number;
    weatherCode: number;
    advice: string;
}

// Simple English-to-Coordinates cache to avoid redundant geocoding 
const geoCache: Record<string, { lat: number, lon: number }> = {};

export async function fetchWeather(locationName: string, targetDateStr: string): Promise<WeatherData | null> {
    try {
        let coords = geoCache[locationName];

        if (!coords) {
            // Step 1: Geocoding via Open-Meteo Geocoding API
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`);
            if (!geoRes.ok) throw new Error("Geocoding failed");
            const geoData = await geoRes.json();
            
            if (!geoData.results || geoData.results.length === 0) {
                console.warn(`No coordinates found for location: ${locationName}`);
                return null;
            }
            
            coords = { 
                lat: geoData.results[0].latitude, 
                lon: geoData.results[0].longitude 
            };
            geoCache[locationName] = coords;
        }

        // Step 2: Fetch forecast via Open-Meteo Weather API (Daily resolution)
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`);
        if (!weatherRes.ok) throw new Error("Weather fetch failed");
        
        const weatherData = await weatherRes.json();
        
        // Find the index for the targetDate
        const dates: string[] = weatherData.daily.time;
        const tempMax = weatherData.daily.temperature_2m_max;
        const tempMin = weatherData.daily.temperature_2m_min;
        const wCodes = weatherData.daily.weather_code;

        const dayIndex = dates.findIndex(d => d === targetDateStr);

        let dataCode = 0;
        let dMin = 0;
        let dMax = 0;

        if (dayIndex !== -1) {
            dataCode = wCodes[dayIndex];
            dMin = Math.round(tempMin[dayIndex]);
            dMax = Math.round(tempMax[dayIndex]);
        } else {
            // Target date is out of the 7-day forecast range, fallback to current day or averages
            // For a robust travel app, we return a general estimate if beyond 10 days
            console.log(`Target date ${targetDateStr} not in 10-day forecast. Serving generic fallback...`);
            return null;
        }

        // Generate clothing advice based on temperature
        let generatedAdvice = '';
        if (dMin <= 0) {
            generatedAdvice = '極度寒冷（零度以下）。請穿著發熱衣、厚毛衣、羽絨外衣，並備齊毛帽、圍巾與防風防水手套。';
        } else if (dMax <= 10) {
            generatedAdvice = '天氣寒冷（10度以下）。建議洋蔥式穿搭：發熱衣 + 保暖中層 + 防風大衣。';
        } else if (dMax <= 18) {
            generatedAdvice = '天氣微涼。建議穿著長袖上衣搭配薄外套或風衣，早晚溫差大。';
        } else if (dMax <= 25) {
            generatedAdvice = '氣候舒適溫暖。短袖或薄長袖為主，可攜帶一件薄外套防曬或防冷氣。';
        } else {
            generatedAdvice = '天氣炎熱。請穿著透氣通風的夏裝，注意防曬並隨時補充水分！';
        }

        // Add rain/snow specific advice
        if (dataCode >= 50 && dataCode <= 67) {
            generatedAdvice += '預報顯示降雨機率高，請務必隨身攜帶雨具 (傘或輕便雨衣)。';
        } else if (dataCode >= 71 && dataCode <= 77) {
            generatedAdvice += '預報將有降雪！步行請穿防滑雪靴，自駕請務必確認車輛配備雪胎。';
        }

        return {
            minTemp: dMin,
            maxTemp: dMax,
            weatherCode: dataCode,
            advice: generatedAdvice
        };

    } catch (err) {
        console.error("Open-Meteo extraction error:", err);
        return null;
    }
}
