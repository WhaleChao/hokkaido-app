import { useState, type CSSProperties } from 'react';
import { MapPin, Camera, Car, Fuel, Clock, TrainFront, Utensils, Footprints, ShoppingBag, Mountain, BedDouble, ChevronRight, X } from 'lucide-react';
import { type Attraction, type Category } from '../data/itinerary';
import clsx from 'clsx';
import { useWikipediaImage } from '../hooks/useWikipediaImage';
import { Modal } from './ui/Modal';
import { mapsSearchUrl, openExternal } from '../utils/url';
import { getSmartMapQuery } from '../utils/mapQuery';
import { Linkify } from './ui/Linkify';

const CATEGORY_ICON: Record<Category, typeof Utensils> = {
    食物: Utensils,
    活動: Footprints,
    購物: ShoppingBag,
    景點: Mountain,
    酒店: BedDouble,
    交通: TrainFront,
};

const TAG_CLASS: Record<string, string> = { 必吃: 'chip-food', 必買: 'chip-shop', 必拍: 'chip-photo' };

interface Props {
    attraction: Attraction;
    defaultRegion?: string;
}

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins} 分鐘`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} 小時 ${m} 分鐘` : `${h} 小時`;
}

function useSubView(attraction: Attraction, initial = 0) {
    const [activeSubIndex, setActiveSubIndex] = useState(initial);
    const subs = attraction.subOptions ?? [];
    const activeSub = subs.length > 0 ? subs[Math.min(activeSubIndex, subs.length - 1)] : null;
    const title = activeSub ? activeSub.name : attraction.name;
    const desc = activeSub ? activeSub.description : attraction.description;
    const orig = activeSub ? activeSub.mapQuery : attraction.mapQuery || attraction.name;
    return { subs, activeSubIndex, setActiveSubIndex, title, desc, mapQuery: getSmartMapQuery(title, desc, orig) };
}

function navigate(mapQuery: string, defaultRegion?: string) {
    openExternal(mapsSearchUrl(defaultRegion ? `${defaultRegion} ${mapQuery}` : mapQuery));
}

function TransitBox({ attraction }: { attraction: Attraction }) {
    const t = attraction.transitDetails;
    if (attraction.category !== '交通' || !t || !(t.line || t.platform || t.exit || t.cost)) return null;
    return (
        <div className="transit-box">
            <strong>
                <TrainFront size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> 乘車資訊
            </strong>
            <div className="transit-grid">
                {t.line && <div>路線：{t.line}</div>}
                {t.platform && <div>月台：{t.platform}</div>}
                {t.exit && <div>出口：{t.exit}</div>}
                {t.cost && <div>車資：{t.cost}</div>}
            </div>
        </div>
    );
}

function DetailModal({ attraction, defaultRegion, initialSubIndex, onClose }: { attraction: Attraction; defaultRegion?: string; initialSubIndex: number; onClose: () => void }) {
    const v = useSubView(attraction, initialSubIndex);
    const Icon = CATEGORY_ICON[attraction.category] ?? Mountain;

    return (
        <Modal title={v.title} onClose={onClose} hideTitle>
            <div className="modal-head" style={{ marginBottom: 4 }}>
                <span className="card-category">
                    <Icon size={18} aria-hidden="true" />
                    {attraction.timeSlot && attraction.timeSlot !== '無' ? `${attraction.timeSlot}・` : ''}
                    {attraction.category}
                </span>
                <button type="button" className="btn-icon" onClick={onClose} aria-label="關閉" data-autofocus>
                    <X size={20} aria-hidden="true" />
                </button>
            </div>
            <div className="chip-group" style={{ marginBottom: 12 }}>
                {attraction.planVariant && <span className="chip chip-brass">{attraction.planVariant}</span>}
                {attraction.isBackup && <span className="chip chip-outline">備選</span>}
                {attraction.startTime && (
                    <span className="chip chip-brass">
                        <Clock size={12} aria-hidden="true" /> {attraction.startTime}
                    </span>
                )}
                {attraction.tags.map((tag) => (
                    <span key={tag} className={clsx('chip', TAG_CLASS[tag])}>
                        {tag}
                    </span>
                ))}
            </div>

            {v.subs.length > 0 && (
                <div className="suboptions" role="group" aria-label="選擇方案">
                    {v.subs.map((sub, idx) => (
                        <button key={idx} type="button" className={clsx('toggle-chip', idx === v.activeSubIndex && 'active')} aria-pressed={idx === v.activeSubIndex} onClick={() => v.setActiveSubIndex(idx)}>
                            {sub.label}
                        </button>
                    ))}
                </div>
            )}

            <h2 className="modal-title" style={{ fontSize: '1.4rem' }}>
                {v.title}
            </h2>

            {(v.desc || (v.subs.length > 0 && attraction.description)) && (
                <div className="detail-desc">
                    {v.subs.length > 0 && attraction.description && (
                        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                            <Linkify text={attraction.description} />
                        </div>
                    )}
                    <Linkify text={v.desc} />
                </div>
            )}

            <TransitBox attraction={attraction} />

            {(attraction.parkingInfo || attraction.gasInfo || attraction.photoTip) && (
                <div style={{ margin: '12px 0' }}>
                    {attraction.parkingInfo && (
                        <div className="detail-tip">
                            <Car size={16} aria-hidden="true" />
                            <span>{attraction.parkingInfo}</span>
                        </div>
                    )}
                    {attraction.gasInfo && (
                        <div className="detail-tip">
                            <Fuel size={16} aria-hidden="true" />
                            <span>{attraction.gasInfo}</span>
                        </div>
                    )}
                    {attraction.photoTip && (
                        <div className="detail-tip">
                            <Camera size={16} aria-hidden="true" />
                            <span>{attraction.photoTip}</span>
                        </div>
                    )}
                </div>
            )}

            {attraction.durationMinutes ? <p className="small muted" style={{ marginBottom: 12 }}>預估停留 {formatDuration(attraction.durationMinutes)}</p> : null}

            <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(v.mapQuery, defaultRegion)}>
                <MapPin size={18} aria-hidden="true" /> 用 Google 地圖導航
            </button>
        </Modal>
    );
}

export function AttractionCard({ attraction, defaultRegion }: Props) {
    const [showDetail, setShowDetail] = useState(false);
    const v = useSubView(attraction);
    const bgImage = useWikipediaImage(v.title);
    const Icon = CATEGORY_ICON[attraction.category] ?? Mountain;

    return (
        <>
            <article className={clsx('attraction-card', attraction.isBackup && 'is-backup', bgImage && 'has-image')} style={bgImage ? ({ '--card-image': `url("${bgImage}")` } as CSSProperties) : undefined}>
                <div className="card-header">
                    <span className="card-category">
                        <Icon size={16} aria-hidden="true" />
                        {attraction.timeSlot && attraction.timeSlot !== '無' ? `${attraction.timeSlot}・` : ''}
                        {attraction.category}
                    </span>
                    <div className="card-tags">
                        {attraction.planVariant && <span className="chip chip-brass">{attraction.planVariant}</span>}
                        {attraction.isBackup && <span className="chip chip-outline">備選</span>}
                        {attraction.startTime && (
                            <span className="chip chip-brass">
                                <Clock size={12} aria-hidden="true" /> {attraction.startTime}
                            </span>
                        )}
                        {attraction.durationMinutes ? <span className="chip chip-outline">{formatDuration(attraction.durationMinutes)}</span> : null}
                        {attraction.tags.map((tag) => (
                            <span key={tag} className={clsx('chip', TAG_CLASS[tag])}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {v.subs.length > 0 && (
                    <div className="suboptions" role="group" aria-label="選擇方案">
                        {v.subs.map((sub, idx) => (
                            <button key={idx} type="button" className={clsx('toggle-chip', idx === v.activeSubIndex && 'active')} aria-pressed={idx === v.activeSubIndex} onClick={() => v.setActiveSubIndex(idx)}>
                                {sub.label}
                            </button>
                        ))}
                    </div>
                )}

                <button type="button" className="card-open" onClick={() => setShowDetail(true)} aria-haspopup="dialog">
                    <h3 className="card-title">{v.title}</h3>
                    {(v.desc || (v.subs.length > 0 && attraction.description)) && (
                        <p className="card-desc">
                            {v.subs.length > 0 && attraction.description && <span className="muted">{attraction.description} - </span>}
                            {v.desc}
                        </p>
                    )}
                </button>

                <TransitBox attraction={attraction} />

                <div className="card-foot">
                    <button type="button" className="btn-map" onClick={() => navigate(v.mapQuery, defaultRegion)}>
                        <MapPin size={16} aria-hidden="true" /> 導航
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowDetail(true)} aria-label={`查看「${v.title}」詳情`}>
                        詳情 <ChevronRight size={16} aria-hidden="true" />
                    </button>
                </div>
            </article>

            {showDetail && <DetailModal attraction={attraction} defaultRegion={defaultRegion} initialSubIndex={v.activeSubIndex} onClose={() => setShowDetail(false)} />}
        </>
    );
}
