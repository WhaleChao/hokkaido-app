import { useState, useEffect } from 'react';

const CACHE_KEY = 'hokkaido_exchange_rates';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface RatesCache {
    rates: Record<string, number>;
    timestamp: number;
}

export function useExchangeRate() {
    const [rates, setRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                // Check local storage cache first
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed: RatesCache = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
                        setRates(parsed.rates);
                        setLoading(false);
                        return; // Cache hit, valid
                    }
                }

                // If cache miss or expired, fetch live rates (USD Base)
                const res = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await res.json();

                if (data && data.rates) {
                    setRates(data.rates);
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        rates: data.rates,
                        timestamp: Date.now()
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch exchange rates:', error);
                // On complete failure, fallback to hardcoded approximate rates if cache also failed
                if (Object.keys(rates).length === 0) {
                    setRates({ JPY: 155, TWD: 32, USD: 1 });
                }
            } finally {
                setLoading(false);
            }
        };

        fetchRates();
    }, []);

    const convert = (amount: number, fromCurrency: string, toCurrency: string) => {
        if (!rates || Object.keys(rates).length === 0) return amount;
        if (fromCurrency === toCurrency) return amount;

        const rateFrom = rates[fromCurrency];
        const rateTo = rates[toCurrency];

        if (!rateFrom || !rateTo) return amount;

        // Convert to USD first, then to target currency
        const usdAmount = amount / rateFrom;
        return usdAmount * rateTo;
    };

    return { rates, loading, convert };
}
