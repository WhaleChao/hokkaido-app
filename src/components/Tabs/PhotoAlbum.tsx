import { useState } from 'react';
import { useItinerary } from '../../hooks/useItinerary';
import { useConfigStore } from '../../hooks/useConfigStore';
import { usePhotoAlbum } from '../../hooks/usePhotoAlbum';
import { Link, Image as ImageIcon, ExternalLink, Save, Edit3, Trash2 } from 'lucide-react';
import { normalizeHttpUrl } from '../../utils/url';
import { useUi } from '../ui/uiContext';
import { dayDisplay } from '../../utils/dayDisplay';

export function PhotoAlbum({ tripId }: { tripId: string }) {
    const { days, loading: dl } = useItinerary(tripId);
    const { config } = useConfigStore(tripId);
    const { loading: al, error, saveAlbumLink, removeAlbumLink, getUrlForDay } = usePhotoAlbum(tripId);
    const ui = useUi();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [temp, setTemp] = useState('');
    const [urlError, setUrlError] = useState('');

    if (dl || al) return <div className="loading" role="status">載入相簿資訊中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;

    const startEdit = (dayId: string, url: string) => {
        setTemp(url);
        setUrlError('');
        setEditingId(dayId);
    };

    const handleSave = async (dayId: string) => {
        if (!temp.trim()) {
            if (await ui.run(() => removeAlbumLink(dayId), '移除連結失敗')) setEditingId(null);
            return;
        }
        const url = normalizeHttpUrl(temp);
        if (!url) {
            setUrlError('這不是有效的網址。請貼上以 https:// 開頭的相簿分享連結。');
            return;
        }
        if (await ui.run(() => saveAlbumLink(dayId, url), '儲存連結失敗', '已儲存相簿連結')) setEditingId(null);
    };

    const handleRemove = async (dayId: string, label: string) => {
        const ok = await ui.confirm({ title: '移除相簿連結？', message: `${label} 的相簿連結會被移除（相簿本身不受影響）。`, confirmText: '移除', danger: true });
        if (ok) await ui.run(() => removeAlbumLink(dayId), '移除連結失敗');
    };

    return (
        <div className="tab-panel">
            <h2 className="section-title">
                <ImageIcon size={22} aria-hidden="true" /> 每日相簿連結
            </h2>
            <p className="section-note">
                為每一天綁定 Google 相簿或 LINE 相簿的分享網址，同行的人一點就能去上傳或下載。這裡只存連結，不會上傳你的照片。
            </p>

            {days.length === 0 && <div className="empty-state">請先到「設定」確認行程日期，就能為每一天加相簿連結。</div>}

            <div className="stack">
                {days.map((day, index) => {
                    const url = getUrlForDay(day.id);
                    const editing = editingId === day.id;
                    const d = dayDisplay(day, index, config.startDate);
                    const label = `第 ${index + 1} 天（${d.date}）`;
                    return (
                        <div key={day.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.05rem' }}>{label}</h3>
                                {!editing && url && (
                                    <div style={{ display: 'flex' }}>
                                        <button type="button" className="btn-icon" onClick={() => startEdit(day.id, url)} aria-label={`編輯 ${label} 的連結`}>
                                            <Edit3 size={18} aria-hidden="true" />
                                        </button>
                                        <button type="button" className="btn-icon danger" onClick={() => void handleRemove(day.id, label)} aria-label={`移除 ${label} 的連結`}>
                                            <Trash2 size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {editing ? (
                                <form
                                    style={{ marginTop: 10 }}
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleSave(day.id);
                                    }}
                                >
                                    <label className="field">
                                        <span className="label">相簿分享連結（留空儲存＝移除）</span>
                                        <input className="input" type="text" inputMode="url" aria-label="相簿分享連結" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="https://photos.app.goo.gl/…" aria-invalid={!!urlError} data-autofocus />
                                        {urlError && (
                                            <p className="field-error" role="alert">
                                                {urlError}
                                            </p>
                                        )}
                                    </label>
                                    <div className="form-actions">
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>
                                            取消
                                        </button>
                                        <button type="submit" className="btn btn-primary">
                                            <Save size={16} aria-hidden="true" /> 儲存
                                        </button>
                                    </div>
                                </form>
                            ) : url ? (
                                <a className="link-btn" style={{ marginTop: 10, justifyContent: 'center' }} href={url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink size={18} aria-hidden="true" /> 前往相簿（新增或瀏覽照片）
                                </a>
                            ) : (
                                <button type="button" className="btn-dashed" style={{ marginTop: 10, minHeight: 48 }} onClick={() => startEdit(day.id, '')}>
                                    <Link size={18} aria-hidden="true" /> 貼上相簿連結
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
