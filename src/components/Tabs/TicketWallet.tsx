import { useRef, useEffect, useState } from 'react';
import { Upload, Trash2, Ticket as TicketIcon, Plane, Lock, Share2 } from 'lucide-react';
import { useTicketStore, type TicketType, type Ticket } from '../../hooks/useTicketStore';
import { useUi } from '../ui/uiContext';
import { Modal } from '../ui/Modal';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.onerror = () => reject(r.error ?? new Error('讀取圖片失敗'));
        r.readAsDataURL(blob);
    });
}

function TicketImage({ blob, label, alt }: { blob: Blob; label: string; alt: string }) {
    const [url, setUrl] = useState('');
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const u = URL.createObjectURL(blob);
        let live = true;
        // 非同步設定，避免 effect 內同步 setState；元件卸載或圖片更換時釋放網址
        queueMicrotask(() => live && setUrl(u));
        return () => {
            live = false;
            URL.revokeObjectURL(u);
        };
    }, [blob]);

    if (!url) return null;
    return (
        <figure className="ticket-figure">
            <figcaption>{label}</figcaption>
            <button type="button" className="ticket-thumb" onClick={() => setOpen(true)} aria-label={`放大查看：${alt}`}>
                <img src={url} alt={alt} />
            </button>
            {open && (
                <Modal title={alt} onClose={() => setOpen(false)} size="md">
                    <img className="lightbox-img" src={url} alt={alt} />
                    <p className="small muted" style={{ marginTop: 8 }}>
                        掃描時請把螢幕亮度調高。
                    </p>
                </Modal>
            )}
        </figure>
    );
}

function TicketCard({ ticket, onDelete }: { ticket: Ticket; onDelete: () => void }) {
    const priv = ticket.type === 'flight' ? '個人憑證（私密）' : '兌換 QR（私密）';
    const pub = ticket.type === 'flight' ? '報到指南（可分享）' : '換票教學（可分享）';
    return (
        <li className="ticket-card">
            <button type="button" className="btn-icon danger delete" onClick={onDelete} aria-label={`刪除票券：${ticket.title}`}>
                <Trash2 size={18} aria-hidden="true" />
            </button>
            <h4>{ticket.title}</h4>
            {ticket.textPayload && <p className="muted">{ticket.textPayload}</p>}
            {(ticket.privateImageBlob || ticket.publicTutorialBlob) && (
                <div className="ticket-images">
                    {ticket.privateImageBlob && <TicketImage blob={ticket.privateImageBlob} label={priv} alt={`${ticket.title} 的${priv}`} />}
                    {ticket.publicTutorialBlob && <TicketImage blob={ticket.publicTutorialBlob} label={pub} alt={`${ticket.title} 的${pub}`} />}
                </div>
            )}
        </li>
    );
}

export function TicketWallet({ tripId }: { tripId: string }) {
    const { tickets, loading, error, addTicket, removeTicket } = useTicketStore(tripId);
    const ui = useUi();
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [type, setType] = useState<TicketType>('transit');
    const [payload, setPayload] = useState('');
    const [titleError, setTitleError] = useState('');
    const privRef = useRef<HTMLInputElement>(null);
    const pubRef = useRef<HTMLInputElement>(null);
    const [priv, setPriv] = useState<File | null>(null);
    const [pub, setPub] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    if (loading) return <div className="loading" role="status">載入票夾中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;

    const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        e.target.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) {
            ui.toast('請選擇圖片檔（照片或截圖）', 'error');
            return;
        }
        if (f.size > MAX_IMAGE_BYTES) {
            ui.toast('這張圖片太大（超過 12 MB），請先縮小再上傳', 'error');
            return;
        }
        setter(f);
    };

    const reset = () => {
        setTitle('');
        setPayload('');
        setPriv(null);
        setPub(null);
        setTitleError('');
        setShowForm(false);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            setTitleError('請輸入票券名稱，例如「星宇航空 JX800」');
            return;
        }
        setSaving(true);
        const ok = await ui.run(
            async () => {
                const b64 = pub ? await blobToDataUrl(pub) : undefined;
                await addTicket({ title: title.trim(), type, textPayload: payload.trim() || undefined, privateImageBlob: priv ?? undefined, publicTutorialBlob: pub ?? undefined, publicTutorialBase64: b64 });
            },
            '儲存票券失敗',
            '已存入票夾',
        );
        setSaving(false);
        if (ok) reset();
    };

    const handleDelete = async (t: Ticket) => {
        const ok = await ui.confirm({ title: '刪除這張票券？', message: `「${t.title}」與它的圖片會從這支手機刪除，無法復原。`, confirmText: '刪除', danger: true });
        if (ok) await ui.run(() => removeTicket(t.id), '刪除失敗');
    };

    const flights = tickets.filter((t) => t.type === 'flight');
    const others = tickets.filter((t) => t.type !== 'flight');

    return (
        <div className="tab-panel">
            <h2 className="section-title">
                <TicketIcon size={22} aria-hidden="true" /> 我的票夾
            </h2>
            <div className="notice" style={{ marginBottom: 14 }}>
                <Lock size={18} aria-hidden="true" />
                <span>票券與 QR 只存在這支手機裡，沒有網路也能看，不會上傳到任何地方。換手機前請先到「設定」做完整備份。</span>
            </div>

            {!showForm && (
                <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 52 }} onClick={() => setShowForm(true)}>
                    <Upload size={18} aria-hidden="true" /> 新增票券或航班
                </button>
            )}

            {showForm && (
                <form
                    className="card"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSave();
                    }}
                    noValidate
                    aria-label="新增票券"
                >
                    <h3 className="section-title" style={{ margin: '0 0 12px' }}>
                        新增票券
                    </h3>
                    <label className="field">
                        <span className="label">類型</span>
                        <select className="select" value={type} onChange={(e) => setType(e.target.value as TicketType)}>
                            <option value="transit">交通票券（JR Pass、周遊券）</option>
                            <option value="flight">航班資訊</option>
                            <option value="other">其他</option>
                        </select>
                    </label>
                    <label className="field">
                        <span className="label">名稱</span>
                        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：星宇航空 JX800" aria-invalid={!!titleError} data-autofocus />
                        {titleError && (
                            <p className="field-error" role="alert">
                                {titleError}
                            </p>
                        )}
                    </label>
                    <label className="field">
                        <span className="label">文字備註（選填）</span>
                        <input className="input" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="例如：第 2 航廈、10:30 起飛" />
                        <span className="hint">
                            <Share2 size={12} aria-hidden="true" style={{ verticalAlign: '-1px' }} /> 這段文字會隨「分享行程」一起給朋友，請不要寫訂位代號或個資。
                        </span>
                    </label>

                    <div className="field">
                        <span className="label">
                            <Lock size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> 個人憑證或 QR（私密，永遠不會分享）
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => privRef.current?.click()}>
                                選擇圖片
                            </button>
                            <span className="small muted" role="status">
                                {priv ? `已選擇：${priv.name}` : '尚未選擇'}
                            </span>
                        </div>
                        <input ref={privRef} type="file" accept="image/*" hidden onChange={pick(setPriv)} />
                    </div>

                    <div className="field">
                        <span className="label">
                            <Share2 size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> 換票教學或地圖（公開，會隨分享給朋友）
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => pubRef.current?.click()}>
                                選擇圖片
                            </button>
                            <span className="small muted" role="status">
                                {pub ? `已選擇：${pub.name}` : '尚未選擇'}
                            </span>
                        </div>
                        <input ref={pubRef} type="file" accept="image/*" hidden onChange={pick(setPub)} />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={reset} disabled={saving}>
                            取消
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? '儲存中…' : '儲存'}
                        </button>
                    </div>
                </form>
            )}

            {flights.length > 0 && (
                <>
                    <h3 className="section-title">
                        <Plane size={20} aria-hidden="true" /> 航班與航廈
                    </h3>
                    <ul className="stack">
                        {flights.map((t) => (
                            <TicketCard key={t.id} ticket={t} onDelete={() => void handleDelete(t)} />
                        ))}
                    </ul>
                </>
            )}
            {others.length > 0 && (
                <>
                    <h3 className="section-title">
                        <TicketIcon size={20} aria-hidden="true" /> 交通與活動票券
                    </h3>
                    <ul className="stack">
                        {others.map((t) => (
                            <TicketCard key={t.id} ticket={t} onDelete={() => void handleDelete(t)} />
                        ))}
                    </ul>
                </>
            )}
            {tickets.length === 0 && !showForm && (
                <div className="empty-state" style={{ marginTop: 16 }}>
                    <TicketIcon size={36} aria-hidden="true" />
                    <p>還沒有任何票券</p>
                </div>
            )}
        </div>
    );
}
