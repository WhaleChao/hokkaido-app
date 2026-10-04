import { useId, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatYMD, parseLooseDate, isValidISODate } from '../../utils/date';

interface Props {
    label: string;
    value: string; // YYYY-MM-DD 或 ''
    onChange: (iso: string) => void;
    min?: string;
    max?: string;
    error?: string;
    required?: boolean;
    autoFocus?: boolean;
}

/**
 * 日期欄位：文字輸入（顯示「2026/02/10」，可直接鍵盤輸入多種寫法）＋日曆按鈕（用系統原生選擇器）。
 * 不用原生 <input type=date> 當主要輸入，因為它的佔位文字（yyyy/月/dd 之類）會跟著瀏覽器語系，中英混雜。
 */
export function DateField({ label, value, onChange, min, max, error, required, autoFocus }: Props) {
    const id = useId();
    const pickerRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState<string | null>(null);
    const [localError, setLocalError] = useState('');

    const shown = draft ?? formatYMD(value);
    const err = error || localError;

    /** 回傳是否接受（接受才會回到格式化顯示；不接受就保留使用者打的字與錯誤訊息） */
    const commit = (text: string): boolean => {
        if (!text.trim()) {
            setLocalError('');
            onChange('');
            return true;
        }
        const iso = parseLooseDate(text);
        if (!iso) {
            setLocalError('日期格式不正確，請輸入像 2026/02/10 這樣的日期');
            return false;
        }
        if (min && isValidISODate(min) && iso < min) {
            setLocalError('日期不能早於 ' + formatYMD(min));
            return false;
        }
        if (max && isValidISODate(max) && iso > max) {
            setLocalError('日期不能晚於 ' + formatYMD(max));
            return false;
        }
        setLocalError('');
        onChange(iso);
        return true;
    };

    return (
        <div className="field">
            <label className="label" htmlFor={id}>
                {label}
            </label>
            <div className="date-field">
                <input
                    id={id}
                    className="input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="年/月/日"
                    value={shown}
                    aria-invalid={!!err}
                    aria-describedby={err ? `${id}-err` : undefined}
                    required={required}
                    autoFocus={autoFocus}
                    data-autofocus={autoFocus ? '' : undefined}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        const iso = parseLooseDate(e.target.value);
                        if (iso && (!min || iso >= min) && (!max || iso <= max)) {
                            setLocalError('');
                            onChange(iso);
                        } else {
                            // 還沒打完或不合法：不能留著上一個合法值，否則按「儲存」會悄悄用到舊日期
                            onChange('');
                        }
                    }}
                    onBlur={() => {
                        if (draft !== null && commit(draft)) setDraft(null);
                    }}
                />
                <span className="date-picker-btn">
                    <CalendarDays size={20} aria-hidden="true" />
                    <input
                        ref={pickerRef}
                        type="date"
                        className="date-picker-native"
                        tabIndex={-1}
                        aria-label={`${label}：開啟日曆選擇`}
                        value={draft === null && isValidISODate(value) ? value : ''}
                        min={min && isValidISODate(min) ? min : undefined}
                        max={max && isValidISODate(max) ? max : undefined}
                        onClick={(e) => {
                            try {
                                e.currentTarget.showPicker?.();
                            } catch {
                                /* 不支援就由瀏覽器預設行為處理 */
                            }
                        }}
                        onChange={(e) => {
                            setDraft(null);
                            setLocalError('');
                            if (e.target.value) onChange(e.target.value);
                        }}
                    />
                </span>
            </div>
            {err && (
                <p className="field-error" id={`${id}-err`} role="alert">
                    {err}
                </p>
            )}
        </div>
    );
}
