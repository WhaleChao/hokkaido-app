import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Camera, Car, Fuel, Clock, TrainFront, X, Maximize2 } from 'lucide-react';
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

function getSmartMapQuery(title: string, desc: string, origMapQuery: string): string {
    let query = title.replace(/\[.*?\]\s*/, '').split('→').pop() || title;

    // 支援通用標題（可能加上前綴或後綴，如 午餐A、男生行程的午餐）
    const genericNames = /.*(早餐|午餐|晚餐|宵夜|點心|下午茶|休息|吃飯|用餐).*/i;

    if (genericNames.test(query.trim()) && desc) {
        // 若原先的 mapQuery 已經包含額外資訊，則保留
        if (origMapQuery && origMapQuery !== title && !genericNames.test(origMapQuery.trim())) {
            return origMapQuery;
        }

        const lines = desc.split('\n').map(l => l.trim()).filter(l => l);
        // 通常真正的店名會寫在「行程簡介」的第一行，而非後面的「備註」中
        let noteLine = lines[0];

        if (noteLine) {
            // 移除 Emoji、項目符號以及「|」後面的交通或雜項資訊
            const cleanDesc = noteLine.replace(/[\u{1F300}-\u{1F9FF}]|📝|^\d+[.、．]\s*|\|.*$/gu, '').trim();
            if (cleanDesc && cleanDesc.length < 20 && cleanDesc !== query.trim()) {
                // 若店名萃取成功，直接使用該店名搜尋，捨去「午餐」等字眼以獲得最佳搜尋結果
                return cleanDesc;
            } else if (cleanDesc && cleanDesc !== query.trim()) {
                return cleanDesc.substring(0, 15);
            }
        }
    }
    return origMapQuery || query;
}

// Convert URLs in text to clickable links
function Linkify({ text }: { text: string }) {
    const parts = text.split(/(https?:\/\/[^\s）)]+)/g);
    return (
        <>
            {parts.map((part, i) =>
                /^https?:\/\//.test(part) ? (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--fuji-blue)', wordBreak: 'break-all' }}
                        onClick={e => e.stopPropagation()}>
                        {part.length > 40 ? part.substring(0, 40) + '…' : part}
                    </a>
                ) : part
            )}
        </>
    );
}

function DetailModal({ attraction, defaultRegion, initialSubIndex = 0, onClose }: { attraction: Attraction, defaultRegion?: string, initialSubIndex?: number, onClose: () => void }) {
    const [activeSubIndex, setActiveSubIndex] = useState(initialSubIndex);
    const hasSubOptions = attraction.subOptions && attraction.subOptions.length > 0;
    const activeSub = hasSubOptions ? attraction.subOptions![activeSubIndex] : null;

    const displayTitle = activeSub ? activeSub.name : attraction.name;
    const displayDesc = activeSub ? activeSub.description : attraction.description;
    const origMapQuery = activeSub ? activeSub.mapQuery : attraction.mapQuery || attraction.name;
    const displayMapQuery = getSmartMapQuery(displayTitle, displayDesc, origMapQuery);

    const bgImage = useWikipediaImage(displayTitle);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.2s ease'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    maxWidth: '500px',
                    width: '100%',
                    maxHeight: '85vh',
                    overflow: 'auto',
                    padding: '24px',
                    position: 'relative',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    ...(bgImage ? {
                        backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,1) 60%), url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center 20%'
                    } : {})
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'sticky', top: 0, float: 'right',
                        background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '50%',
                        width: '36px', height: '36px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1
                    }}
                >
                    <X size={18} />
                </button>

                {/* Category & Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem' }}>{categoryIconMap[attraction.category] || '📍'}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        {attraction.timeSlot && attraction.timeSlot !== '無' ? `[${attraction.timeSlot}] ` : ''}{attraction.category}
                    </span>
                    {attraction.planVariant && (
                        <span style={{
                            padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem',
                            backgroundColor: attraction.planVariant === 'A' ? 'var(--fuji-blue)' : 'var(--sage-green)',
                            color: 'white', fontWeight: 'bold'
                        }}>
                            {attraction.planVariant} 方案
                        </span>
                    )}
                    {attraction.isBackup && (
                        <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', backgroundColor: '#e0e0e0', color: '#666', border: '1px dashed #999' }}>
                            備選
                        </span>
                    )}
                    {attraction.startTime && (
                        <span style={{
                            padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem',
                            backgroundColor: 'rgba(52, 88, 153, 0.1)', color: 'var(--fuji-blue)',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                            <Clock size={12} /> {attraction.startTime}
                        </span>
                    )}
                    {attraction.tags.map((tag: string) => (
                        <span key={tag} className={clsx('card-tag', tagColorMap[tag] || 'tag-default')}>
                            {tag}
                        </span>
                    ))}
                </div>

                {/* SubOptions Tabs (if any) */}
                {hasSubOptions && (
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
                        {attraction.subOptions!.map((sub, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveSubIndex(idx)}
                                style={{
                                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600,
                                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                                    backgroundColor: activeSubIndex === idx ? 'var(--fuji-blue)' : 'rgba(0,0,0,0.05)',
                                    color: activeSubIndex === idx ? 'white' : 'var(--text-light)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Title */}
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', lineHeight: 1.3 }}>
                    {displayTitle}
                </h2>

                {/* Description — fully visible, with line breaks */}
                {(displayDesc || (hasSubOptions && attraction.description)) && (
                    <div style={{
                        fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        backgroundColor: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '12px',
                        marginBottom: '16px'
                    }}>
                        {hasSubOptions && attraction.description && (
                            <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.1)', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                <Linkify text={attraction.description} />
                            </div>
                        )}
                        <Linkify text={displayDesc} />
                    </div>
                )}

                {/* Transit Details */}
                {attraction.category === '交通' && attraction.transitDetails && Object.keys(attraction.transitDetails).length > 0 && (
                    <div style={{ marginBottom: '16px', backgroundColor: 'var(--snow-white)', padding: '16px', borderRadius: '12px', borderLeft: '4px solid var(--fuji-blue)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--fuji-blue)', fontWeight: 600, fontSize: '1rem' }}>
                            <TrainFront size={18} /> 乘車資訊
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                            {attraction.transitDetails.line && <div><span style={{ color: 'var(--text-light)' }}>路線:</span> {attraction.transitDetails.line}</div>}
                            {attraction.transitDetails.platform && <div><span style={{ color: 'var(--text-light)' }}>月台:</span> {attraction.transitDetails.platform}</div>}
                            {attraction.transitDetails.exit && <div><span style={{ color: 'var(--text-light)' }}>出口:</span> {attraction.transitDetails.exit}</div>}
                            {attraction.transitDetails.cost && <div><span style={{ color: 'var(--text-light)' }}>車資:</span> {attraction.transitDetails.cost}</div>}
                        </div>
                    </div>
                )}

                {/* Tips */}
                {(attraction.parkingInfo || attraction.gasInfo || attraction.photoTip) && (
                    <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                        {attraction.parkingInfo && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <Car size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-light)' }} />
                                <span>{attraction.parkingInfo}</span>
                            </div>
                        )}
                        {attraction.gasInfo && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <Fuel size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-light)' }} />
                                <span>{attraction.gasInfo}</span>
                            </div>
                        )}
                        {attraction.photoTip && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <Camera size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-light)' }} />
                                <span>{attraction.photoTip}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Duration */}
                {attraction.durationMinutes && attraction.durationMinutes > 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '16px' }}>
                        ⏱️ 預估停留 {attraction.durationMinutes >= 60 ? `${Math.floor(attraction.durationMinutes / 60)} 小時${attraction.durationMinutes % 60 > 0 ? ` ${attraction.durationMinutes % 60} 分鐘` : ''}` : `${attraction.durationMinutes} 分鐘`}
                    </div>
                )}

                {/* Navigation button */}
                <button
                    style={{
                        width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                        backgroundColor: 'var(--fuji-blue)', color: 'white',
                        fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(52, 88, 153, 0.3)'
                    }}
                    onClick={() => {
                        const finalQuery = defaultRegion ? `${defaultRegion} ${displayMapQuery}` : displayMapQuery;
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalQuery)}`, '_blank');
                    }}
                >
                    <MapPin size={18} /> 開始導航
                </button>
            </div>
        </div>
    );
}

export function AttractionCard({ attraction, defaultRegion }: Props) {
    const [showDetail, setShowDetail] = useState(false);
    const [activeSubIndex, setActiveSubIndex] = useState(0);

    const hasSubOptions = attraction.subOptions && attraction.subOptions.length > 0;
    const activeSub = hasSubOptions ? attraction.subOptions![activeSubIndex] : null;

    const displayTitle = activeSub ? activeSub.name : attraction.name;
    const displayDesc = activeSub ? activeSub.description : attraction.description;
    const origMapQuery = activeSub ? activeSub.mapQuery : attraction.mapQuery || attraction.name;
    const displayMapQuery = getSmartMapQuery(displayTitle, displayDesc, origMapQuery);

    const bgImage = useWikipediaImage(displayTitle);

    return (
        <>
            <div
                className={clsx("attraction-card", { "is-backup": attraction.isBackup })}
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    ...(bgImage ? {
                        backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,1) 100%), url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center 30%'
                    } : {})
                }}
                onClick={() => setShowDetail(true)}
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
                {hasSubOptions && (
                    <div className="card-suboptions" style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }} onClick={e => e.stopPropagation()}>
                        {attraction.subOptions!.map((sub, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveSubIndex(idx)}
                                style={{
                                    padding: '4px 10px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 600,
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                    backgroundColor: activeSubIndex === idx ? 'var(--fuji-blue)' : 'var(--snow-white)',
                                    color: activeSubIndex === idx ? 'white' : 'var(--text-light)',
                                    border: activeSubIndex === idx ? '1px solid var(--fuji-blue)' : '1px solid #ddd',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>
                )}

                <h3 className="card-title" style={{ color: attraction.isBackup ? '#666' : 'var(--text-main)', textDecoration: attraction.isBackup ? 'underline' : 'none', textDecorationStyle: 'dotted' }}>
                    {displayTitle}
                </h3>

                {(displayDesc || (hasSubOptions && attraction.description)) && (
                    <p className="card-desc" style={{
                        fontStyle: attraction.isBackup ? 'italic' : 'normal',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {hasSubOptions && attraction.description && <span style={{ color: 'var(--text-light)' }}>{attraction.description} - </span>}
                        {displayDesc}
                    </p>
                )}

                {/* Expand hint */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                        <button
                            className="btn-map"
                            onClick={() => {
                                const finalQuery = defaultRegion ? `${defaultRegion} ${displayMapQuery}` : displayMapQuery;
                                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(finalQuery)}`, '_blank');
                            }}
                        >
                            <MapPin size={16} /> 導航
                        </button>
                    </div>
                    <Maximize2 size={14} style={{ color: 'var(--text-light)', opacity: 0.5 }} />
                </div>

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

            {showDetail && createPortal(
                <DetailModal
                    attraction={attraction}
                    defaultRegion={defaultRegion}
                    initialSubIndex={activeSubIndex}
                    onClose={() => setShowDetail(false)}
                />,
                document.body
            )}
        </>
    );
}
