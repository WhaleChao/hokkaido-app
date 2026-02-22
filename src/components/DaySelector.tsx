import clsx from 'clsx';
import { type DayItinerary } from '../data/itinerary';

interface Props {
    days: DayItinerary[];
    selectedDayId: string;
    onSelectDay: (id: string) => void;
}

export function DaySelector({ days, selectedDayId, onSelectDay }: Props) {
    return (
        <div className="day-selector no-scrollbar">
            {days.map((day) => (
                <button
                    key={day.id}
                    className={clsx('day-pill', day.id === selectedDayId && 'active')}
                    onClick={() => onSelectDay(day.id)}
                >
                    <div className="day-label">{day.dayLabel}</div>
                    <div className="day-date">{day.date}</div>
                </button>
            ))}
        </div>
    );
}
