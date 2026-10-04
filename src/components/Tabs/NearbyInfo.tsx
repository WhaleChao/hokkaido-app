import { useConfigStore } from '../../hooks/useConfigStore';
import { TripConfigCard } from '../settings/TripConfigCard';
import { AccommodationCard } from '../settings/AccommodationCard';
import { ShareCard } from '../settings/ShareCard';
import { DataCard } from '../settings/DataCard';
import { AppearanceCard } from '../settings/AppearanceCard';
import { LinksCard } from '../settings/LinksCard';

/** 「設定」分頁：旅程設定、住宿與附近資訊、共用、備份、外觀。 */
export function NearbyInfo({ tripId }: { tripId: string }) {
    const { config, updateConfig, loading, error } = useConfigStore(tripId);

    if (loading) return <div className="loading" role="status">載入設定中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;

    return (
        <div className="tab-panel">
            <TripConfigCard config={config} updateConfig={updateConfig} />
            <AccommodationCard config={config} updateConfig={updateConfig} />
            <ShareCard tripId={tripId} />
            <DataCard tripId={tripId} />
            <AppearanceCard />
            <LinksCard config={config} />
        </div>
    );
}
