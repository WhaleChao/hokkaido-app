import { useState } from 'react';
import { AlertTriangle, ShieldCheck, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { useCustomsData } from '../hooks/useCustomsData';
import { selectRules, freshness, type CustomsRule, type RuleSource, type SourceStatus } from '../utils/customs';
import { visibleLocation } from '../data/config';
import { formatYMD } from '../utils/date';
import { openExternal } from '../utils/url';

const dayOf = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : formatYMD(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
};

function RuleCard({ rule, source, status, defaultOpen, now }: { rule: CustomsRule; source: RuleSource; status?: SourceStatus; defaultOpen: boolean; now: number }) {
    const fresh = freshness(status, now);
    const recentChange = rule.change && now - Date.parse(rule.change.at) < 30 * 86400000 ? rule.change : null;
    return (
        <details className="card customs-rule" open={defaultOpen}>
            <summary className="customs-summary">
                <span className="customs-title">{rule.title}</span>
                {recentChange && <span className="chip chip-brass">規則已更新 {formatYMD(recentChange.at.slice(0, 10))}</span>}
                {fresh?.kind === 'review' && <span className="chip chip-warn">待確認</span>}
            </summary>
            <div className="customs-body">
                <p className="muted small">{rule.lead}</p>

                {rule.mode === 'curated' ? (
                    <>
                        <ul className="customs-list">
                            {rule.summary?.map((p, i) => (
                                <li key={i}>{p}</li>
                            ))}
                        </ul>
                        <details className="customs-orig">
                            <summary>官方原文（{source.lang === 'en' ? '英文' : '日文'}）</summary>
                            <ul className="customs-list" lang={source.lang}>
                                {rule.items.map((p, i) => (
                                    <li key={i}>{p}</li>
                                ))}
                            </ul>
                            <p className="hint">這是人工整理上方摘要時所對照的官方原文；官方內容變動時，摘要會標示「待確認」。</p>
                        </details>
                    </>
                ) : (
                    <ol className="customs-list">
                        {rule.items.map((p, i) => (
                            <li key={i}>{p}</li>
                        ))}
                    </ol>
                )}

                {recentChange && (
                    <div className="notice" role="note" style={{ marginTop: 10 }}>
                        <Info size={16} aria-hidden="true" />
                        <span>
                            官方內容有變動，已自動更新（{recentChange.summary}）。
                            {recentChange.added && recentChange.added.length > 0 && <> 新增：{recentChange.added.join('；')}</>}
                        </span>
                    </div>
                )}

                <p className="small muted customs-source">
                    來源：{source.agency}「{source.name}」
                    {status ? `・最後核對 ${dayOf(status.checked_at)}${source.manual ? '（人工核對）' : ''}` : ''}
                    {source.published ? `・官方頁面標示發布日期 ${formatYMD(source.published)}` : ''}
                </p>
                <button type="button" className="link-btn" onClick={() => openExternal(source.url)}>
                    <ExternalLink size={18} aria-hidden="true" /> 開啟官方網頁核對
                </button>
            </div>
        </details>
    );
}

export function CustomsPanel({ location }: { location: string }) {
    const { rules, status, statusLive, loading, error } = useCustomsData();
    const [now] = useState(() => Date.now());
    const loc = visibleLocation(location);

    if (loading && !rules) return <div className="loading" role="status">載入海關提醒中…</div>;
    if (!rules) {
        return (
            <div className="notice notice-warn" role="note">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{error || '海關提醒暫時無法載入'}。出發前請自行查閱目的地與台灣的海關、檢疫公告。</span>
            </div>
        );
    }

    const selected = selectRules(loc, rules.rules);
    const sourceOf = (r: CustomsRule) => rules.sources.find((s) => s.id === r.source_id)!;
    const statuses = selected.map((r) => ({ rule: r, st: status?.sources[r.source_id] }));
    const needReview = statuses.filter((x) => x.st?.status === 'review');
    const stale = statuses.filter((x) => x.st && x.st.status !== 'review' && (freshness(x.st, now)?.kind === 'stale' || x.st.status === 'error'));
    const checkedTimes = statuses.map((x) => (x.st ? Date.parse(x.st.checked_at) : NaN)).filter((n) => !Number.isNaN(n));
    const lastChecked = checkedTimes.length ? new Date(Math.min(...checkedTimes)).toISOString() : status?.checked_at;
    const hasDestination = selected.some((r) => !r.always);

    return (
        <section aria-labelledby="customs-title" className="customs-panel">
            <h2 className="section-title" id="customs-title" style={{ marginTop: 0 }}>
                <ShieldCheck size={20} aria-hidden="true" /> 海關與檢疫提醒
            </h2>
            <p className="small muted" role="status">
                {lastChecked
                    ? statusLive
                        ? `已於 ${dayOf(lastChecked)} 核對官方來源`
                        : `目前無法連線核對，顯示 ${dayOf(lastChecked)} 存下的資料`
                    : '尚無核對紀錄'}
                。僅供提醒，不具法律效力，請以官方公告為準。
            </p>

            {needReview.length > 0 && (
                <div className="notice notice-warn" role="alert" style={{ marginBottom: 10 }}>
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>
                        <strong>官方來源有變動待確認，請以官方網站為準</strong>
                        下列項目的官方頁面內容和上次核對的不同，還沒有確認過：{needReview.map((x) => x.rule.title).join('、')}。
                    </span>
                </div>
            )}
            {stale.length > 0 && (
                <div className="notice" role="note" style={{ marginBottom: 10 }}>
                    <RefreshCw size={16} aria-hidden="true" />
                    <span>部分項目已太久沒有核對官方來源（自動核對項目 7 天、人工核對項目 45 天），內容可能已經過時，請開啟官方網頁確認。</span>
                </div>
            )}
            {loc && !hasDestination && (
                <div className="notice" role="note" style={{ marginBottom: 10 }}>
                    <Info size={16} aria-hidden="true" />
                    <span>目的地「{loc}」目前沒有已核對的官方整理（現有日本、新加坡），請查詢當地海關與檢疫機關的公告。下方是回台灣時的規定。</span>
                </div>
            )}
            {!loc && (
                <div className="notice" role="note" style={{ marginBottom: 10 }}>
                    <Info size={16} aria-hidden="true" />
                    <span>到「設定」填寫主要地點，就會一併顯示目的地的入境提醒。</span>
                </div>
            )}

            <div className="stack">
                {statuses.map(({ rule, st }) => (
                    <RuleCard key={rule.id} rule={rule} source={sourceOf(rule)} status={st} defaultOpen={!rule.always} now={now} />
                ))}
            </div>
        </section>
    );
}
