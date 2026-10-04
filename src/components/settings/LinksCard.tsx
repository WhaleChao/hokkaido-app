import { Users, Navigation, Map as MapIcon, CloudSun, ExternalLink, ShieldCheck } from 'lucide-react';
import { type AppConfig, visibleLocation } from '../../data/config';
import { openExternal } from '../../utils/url';

export function LinksCard({ config }: { config: AppConfig }) {
    const loc = visibleLocation(config.location);
    return (
        <>
            <section aria-labelledby="season-title">
                <h2 className="section-title" id="season-title">
                    <CloudSun size={20} aria-hidden="true" /> 季節情報
                </h2>
                <div className="link-list">
                    <button type="button" className="link-btn" onClick={() => openExternal(`https://www.google.com/search?q=${encodeURIComponent(`${loc || '日本'} 花期 櫻花 楓葉 情報`)}`)}>
                        <ExternalLink size={18} aria-hidden="true" /> 用 Google 搜尋花期與季節情報
                    </button>
                    <button type="button" className="link-btn" onClick={() => openExternal(`https://tenki.jp/search/?keyword=${encodeURIComponent(loc || '東京')}`)}>
                        <ExternalLink size={18} aria-hidden="true" /> 查日本氣象廳（tenki.jp）
                    </button>
                </div>
            </section>

            <section aria-labelledby="loc-title">
                <h2 className="section-title" id="loc-title">
                    <Users size={20} aria-hidden="true" /> 旅伴位置分享
                </h2>
                <p className="section-note">建議全團出發前先設定好互相分享位置。原生 App 比網頁省電。</p>
                <div className="link-list">
                    <button type="button" className="link-btn" onClick={() => openExternal('https://support.google.com/maps/answer/7326816?hl=zh-Hant')}>
                        <MapIcon size={18} aria-hidden="true" /> Google 地圖位置資訊分享
                    </button>
                    <a className="link-btn" href="findmy://">
                        <Navigation size={18} aria-hidden="true" /> 開啟 iPhone「尋找」App
                    </a>
                </div>
            </section>

            <section aria-labelledby="privacy-title">
                <h2 className="section-title" id="privacy-title">
                    <ShieldCheck size={20} aria-hidden="true" /> 隱私與外部服務
                </h2>
                <div className="card">
                    <p className="small" style={{ marginBottom: 8 }}>
                        這個 App 沒有帳號、沒有伺服器，你的資料只存在這支手機。使用下列功能時會連到外部服務，且都不需要任何金鑰：
                    </p>
                    <ul className="steps" style={{ listStyle: 'disc' }}>
                        <li>
                            天氣：把「主要地點」文字傳給 Open-Meteo，查詢座標與預報。
                        </li>
                        <li>匯率：只下載公開匯率表（ExchangeRate-API），不會送出任何你的資料。</li>
                        <li>景點背景圖：把景點名稱傳給維基百科查縮圖。</li>
                        <li>導航、搜尋、相簿連結：點了才會開啟對應網站（Google 地圖等）。</li>
                    </ul>
                    <p className="small muted" style={{ marginTop: 8 }}>
                        票券、QR、記帳與照片不會傳到任何地方。
                    </p>
                </div>
            </section>
        </>
    );
}
