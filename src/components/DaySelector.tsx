import clsx from 'clsx';
import { type DayItinerary } from '../data/itinerary';
import { dayDisplay } from '../utils/dayDisplay';

interface Props {
    days: DayItinerary[];
    selectedDayId: string;
    onSelectDay: (id: string) => void;
    startDate?: string;
    todayISO?: string;
}

export function DaySelector({ days, selectedDayId, onSelectDay, startDate, todayISO }: Props) {
    return (
        <div className="day-selector" role="group" aria-label="選擇第幾天">
            {days.map((day, i) => {
                const d = dayDisplay(day, i, startDate);
                const isToday = !!todayISO && d.iso === todayISO;
                return (
                    <button
                        key={day.id}
                        type="button"
                        className={clsx('day-pill', day.id === selectedDayId && 'active')}
                        aria-pressed={day.id === selectedDayId}
                        onClick={() => onSelectDay(day.id)}
                    >
                        <span className="day-label">
                            第 {i + 1} 天
                            {isToday && <span className="today-dot" role="img" aria-label="今天" />}
                        </span>
                        <span className="day-date">
                            {d.date}
                            {d.weekday && `（${d.weekday}）`}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
