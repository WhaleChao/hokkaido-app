import { useState } from 'react';
import { Palette } from 'lucide-react';
import { readTheme, setTheme, type ThemeChoice } from '../../utils/theme';

const OPTIONS: { id: ThemeChoice; label: string }[] = [
    { id: 'auto', label: '跟隨系統' },
    { id: 'light', label: '淺色' },
    { id: 'dark', label: '深色' },
];

export function AppearanceCard() {
    const [choice, setChoice] = useState<ThemeChoice>(readTheme);
    return (
        <section aria-labelledby="look-title">
            <h2 className="section-title" id="look-title">
                <Palette size={20} aria-hidden="true" /> 外觀
            </h2>
            <div className="card">
                <div className="segmented" role="group" aria-label="色彩主題">
                    {OPTIONS.map((o) => (
                        <button
                            key={o.id}
                            type="button"
                            aria-pressed={choice === o.id}
                            onClick={() => {
                                setChoice(o.id);
                                setTheme(o.id);
                            }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
