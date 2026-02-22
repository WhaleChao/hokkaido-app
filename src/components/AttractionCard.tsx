import { MapPin, Camera, Car, Fuel, Clock, TrainFront } from 'lucide-react';
import { type Attraction } from '../data/itinerary';
import clsx from 'clsx';
import { useWikipediaImage } from '../hooks/useWikipediaImage';

const categoryIconMap: Record<string, string> = {
    '食物': '🍜',
    '活動': '⛷️',
    '購物': '🛍️',
    '景點': '🏔️',
    '酒店': '🏨',
    '交通': '✈️'
};

const tagColorMap: Record<string, string> = {
    '必吃': 'tag-food',
    '必買': 'tag-shop',
    '必拍': 'tag-photo'
};

interface Props {
    attraction: Attraction;
    defaultRegion?: string;
}

export function AttractionCard({ attraction, defaultRegion }: Props) {
    const bgImage = useWikipediaImage(attraction.name);

    return (
        <div
            className={clsx("attraction-card", { "is-backup": attraction.isBackup })}
            style={{
                position: 'relative',
                overflow: 'hidden',
                ...(bgImage ? {
                    backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,1) 100%), url(${bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%' // Usually the subject is slightly above center
                } : {})
            }}
        >
            <div className="card-header">
                <div className="card-category">
                    <span className="category-icon">{categoryIconMap[attraction.category] || '📍'}</span>
                    <span>{attraction.timeSlot && attraction.timeSlot !== '無' ? `[${attraction.timeSlot}] ` : ''}{attraction.category}</span>
                </div>
                <div className="card-tags">
                    {attraction.planVariant && (
                        <span className="card-tag" style={{ backgroundColor: attraction.planVariant === 'A' ? 'var(--fuji-blue)' : 'var(--sage-green)', color: 'white', fontWeight: 'bold' }}>
                            {attraction.planVariant} 方案
                        </span>
                    )}
                    {attraction.isBackup && (
                        <span className="card-tag" style={{ backgroundColor: '#e0e0e0', color: '#666', border: '1px dashed #999' }}>
                            備選
                        </span>
                    )}
                    {attraction.startTime && (
                        <span className="card-tag" style={{ backgroundColor: 'rgba(52, 88, 153, 0.1)', color: 'var(--fuji-blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {attraction.startTime}
                        </span>
                    )}
                    {attraction.durationMinutes && attraction.durationMinutes > 0 && (
                        <span className="card-tag" style={{ backgroundColor: 'transparent', color: 'var(--text-light)', border: '1px solid #ddd' }}>
                            ⏱️ {attraction.durationMinutes >= 60 ? `${Math.floor(attraction.durationMinutes / 60)}h${attraction.durationMinutes % 60 > 0 ? ` ${attraction.durationMinutes % 60}m` : ''}` : `${attraction.durationMinutes}m`}
                        </span>
                    )}
                    {attraction.tags.map((tag: string) => (
                        <span key={tag} className={clsx('card-tag', tagColorMap[tag] || 'tag-default')}>
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <h3 className="card-title" style={{ color: attraction.isBackup ? '#666' : 'var(--text-main)', textDecoration: attraction.isBackup ? 'underline' : 'none', textDecorationStyle: 'dotted' }}>
                {attraction.name}
            </h3>

            {attraction.description && (
                <p className="card-desc" style={{ fontStyle: attraction.isBackup ? 'italic' : 'normal' }}>
                    {attraction.description}
                </p>
            )}

            <div className="card-actions">
                <button
                    className="btn-map"
                    onClick={() => {
                        const baseQuery = attraction.mapQuery || attraction.name;
                        const finalQuery = defaultRegion ? `${defaultRegion} ${baseQuery}` : baseQuery;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(finalQuery)}`, '_blank');
                    }}
                >
                    <MapPin size={16} /> 導航
                </button>
                {attraction.hasPhotoUpload && (
                    <button className="btn-photo">
                        <Camera size={16} /> 旅記
                    </button>
                )}
            </div>

            {(attraction.parkingInfo || attraction.gasInfo || attraction.photoTip) && (
                <div className="card-tips" style={{ marginTop: '16px' }}>
                    {attraction.parkingInfo && (
                        <div className="tip-row"><Car size={14} className="tip-icon" /> <span>{attraction.parkingInfo}</span></div>
                    )}
                    {attraction.gasInfo && (
                        <div className="tip-row"><Fuel size={14} className="tip-icon" /> <span>{attraction.gasInfo}</span></div>
                    )}
                    {attraction.photoTip && (
                        <div className="tip-row"><Camera size={14} className="tip-icon" /> <span>{attraction.photoTip}</span></div>
                    )}
                </div>
            )}

            {attraction.category === '交通' && attraction.transitDetails && Object.keys(attraction.transitDetails).length > 0 && (
                <div style={{ marginTop: '16px', backgroundColor: 'var(--snow-white)', padding: '12px', borderRadius: '12px', borderLeft: '4px solid var(--fuji-blue)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--fuji-blue)', fontWeight: 600, fontSize: '0.9rem' }}>
                        <TrainFront size={16} /> 乘車資訊
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        {attraction.transitDetails.line && <div><span style={{ color: 'var(--text-light)' }}>路線:</span> {attraction.transitDetails.line}</div>}
                        {attraction.transitDetails.platform && <div><span style={{ color: 'var(--text-light)' }}>月台:</span> {attraction.transitDetails.platform}</div>}
                        {attraction.transitDetails.exit && <div><span style={{ color: 'var(--text-light)' }}>出口:</span> {attraction.transitDetails.exit}</div>}
                        {attraction.transitDetails.cost && <div><span style={{ color: 'var(--text-light)' }}>車資:</span> {attraction.transitDetails.cost}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
