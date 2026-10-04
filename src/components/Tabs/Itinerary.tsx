import { useState } from 'react';
import { DaySelector } from '../DaySelector';
import { dayDisplay } from '../../utils/dayDisplay';
import { AttractionCard } from '../AttractionCard';
import { DailyAdvice } from '../DailyAdvice';
import { useItinerary } from '../../hooks/useItinerary';
import { AddAttractionForm } from './AddAttractionForm';
import { Edit2, Plus, X, FileUp, GripVertical, MapPin, Check, CalendarX } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Attraction } from '../../data/itinerary';
import { parseSpreadsheetData, type ParseResult } from '../../utils/parser';
import { SpreadsheetImportModal } from '../SpreadsheetImportModal';
import { useConfigStore } from '../../hooks/useConfigStore';
import { useUi } from '../ui/uiContext';
import { takeSnapshot, writeDays, reconcileOrder, patchConfig } from '../../utils/tripData';
import { addDaysISO, todayISO } from '../../utils/date';
import { itineraryStore } from '../../db';
import { mapsSearchUrl, openExternal } from '../../utils/url';
import clsx from 'clsx';

interface SortableProps {
    attraction: Attraction;
    editMode: boolean;
    isEditing: boolean;
    defaultRegion?: string;
    onDelete: (id: string) => void;
    onEdit: () => void;
    onSaveEdit: (updated: Attraction) => void;
    onCancelEdit: () => void;
}

function SortableAttractionItem({ attraction, editMode, isEditing, defaultRegion, onDelete, onEdit, onSaveEdit, onCancelEdit }: SortableProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: attraction.id, disabled: !editMode || isEditing });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined };

    return (
        <div ref={setNodeRef} style={style} className={clsx('attraction-wrapper', editMode && !isEditing && 'editing-pad')}>
            {editMode && !isEditing && (
                <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`拖曳排序：${attraction.name}（鍵盤可按空白鍵拿起、方向鍵移動）`}>
                    <GripVertical size={22} aria-hidden="true" />
                </button>
            )}
            {isEditing ? (
                <div className="card">
                    <AddAttractionForm editAttraction={attraction} onSave={onSaveEdit} onCancel={onCancelEdit} />
                </div>
            ) : (
                <AttractionCard attraction={attraction} defaultRegion={defaultRegion} />
            )}
            {editMode && !isEditing && (
                <div className="card-actions-edit">
                    <button type="button" className="btn-circle" onClick={onEdit} aria-label={`編輯：${attraction.name}`}>
                        <Edit2 size={18} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-circle danger" onClick={() => onDelete(attraction.id)} aria-label={`刪除：${attraction.name}`}>
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}

export function Itinerary({ tripId }: { tripId: string }) {
    const { config } = useConfigStore(tripId);
    const { days, loading, error, updateDay, reload } = useItinerary(tripId);
    const ui = useUi();
    const [selectedDayId, setSelectedDayId] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [variantFilter, setVariantFilter] = useState('ALL');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    if (loading) return <div className="loading" role="status">載入行程中…</div>;
    if (error) return <div className="notice notice-error" role="alert">{error}</div>;
    if (!days.length) {
        return (
            <div className="empty-state">
                <CalendarX size={36} aria-hidden="true" />
                <p>目前沒有可顯示的行程天數。</p>
                <p className="small">請到「設定」檢查出發日與結束日是否正確。</p>
            </div>
        );
    }

    const today = todayISO();
    const todayIndex = days.findIndex((d, i) => dayDisplay(d, i, config.startDate).iso === today);
    const currentDay = days.find((d) => d.id === selectedDayId) ?? days[todayIndex >= 0 ? todayIndex : 0];
    const currentIndex = days.findIndex((d) => d.id === currentDay.id);

    const saveAttractions = (fn: (list: Attraction[]) => Attraction[], failText: string) =>
        ui.run(() => updateDay(currentDay.id, (d) => ({ ...d, attractions: fn(d.attractions) })), failText);

    const handleAdd = async (attraction: Attraction) => {
        if (await saveAttractions((l) => [...l, attraction], '新增景點失敗')) setShowAddForm(false);
    };

    const handleSaveEdit = async (updated: Attraction) => {
        if (await saveAttractions((l) => l.map((a) => (a.id === updated.id ? updated : a)), '儲存景點失敗')) setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        const target = currentDay.attractions.find((a) => a.id === id);
        const ok = await ui.confirm({ title: '刪除這個景點？', message: target ? `「${target.name}」會從第 ${currentIndex + 1} 天移除，無法復原。` : undefined, confirmText: '刪除', danger: true });
        if (ok) await saveAttractions((l) => l.filter((a) => a.id !== id), '刪除景點失敗');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        void saveAttractions((list) => {
            const from = list.findIndex((a) => a.id === active.id);
            const to = list.findIndex((a) => a.id === over.id);
            return from < 0 || to < 0 ? list : arrayMove(list, from, to);
        }, '調整順序失敗');
    };

    /** 回傳錯誤字串讓匯入視窗顯示；成功回傳 null。 */
    const handleImport = async (tsv: string): Promise<string | null> => {
        const result: ParseResult = parseSpreadsheetData(tsv, days);
        if (!result.ok) return result.error ?? '無法解析表格';

        const replaced = result.touchedIndexes.reduce((n, i) => n + (days[i]?.attractions.length ?? 0), 0);
        const lines = [`將匯入 ${result.parsedItems} 個景點到 ${result.touchedDays} 天，取代這些天原有的 ${replaced} 個景點。`];
        if (result.addedDays > 0) lines.push(`表格天數比行程多，會自動把結束日延後 ${result.addedDays} 天。`);
        lines.push(...result.warnings, '匯入前會自動保存一份還原點，可以在「設定」頁還原。');
        const ok = await ui.confirm({ title: '確定匯入這份表格？', message: lines.join('\n'), confirmText: '匯入' });
        if (!ok) return '';

        const done = await ui.run(
            async () => {
                await takeSnapshot(tripId, '匯入試算表前自動保存');
                if (result.addedDays > 0) {
                    const end = addDaysISO(config.startDate, result.days.length - 1);
                    if (end) await patchConfig(tripId, { endDate: end });
                }
                const order = reconcileOrder(await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`), result.days.length);
                await writeDays(tripId, result.days, order);
                await reload();
            },
            '匯入失敗，原本的行程沒有被改動',
            `匯入完成：${result.parsedItems} 個景點`,
        );
        return done ? null : '';
    };

    const uniqueVariants = Array.from(new Set(currentDay.attractions.map((a) => a.planVariant?.trim()).filter(Boolean))) as string[];
    const activeVariant = uniqueVariants.includes(variantFilter) ? variantFilter : 'ALL';
    const visible = currentDay.attractions.filter((a) => activeVariant === 'ALL' || !a.planVariant?.trim() || a.planVariant.trim() === activeVariant);

    const totalMins = currentDay.attractions.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
    const over = totalMins > 720;

    const currentISO = dayDisplay(currentDay, currentIndex, config.startDate).iso;
    const hotels = (config.accommodations ?? []).filter((acc) => {
        if (!acc.checkIn || !acc.checkOut || !currentISO) return true;
        return currentISO >= acc.checkIn && currentISO <= acc.checkOut;
    });

    return (
        <div className="tab-panel">
            <div className="toolbar">
                <button type="button" className="btn-toolbar" onClick={() => setShowImportModal(true)}>
                    <FileUp size={18} aria-hidden="true" /> 匯入表格
                </button>
                <button
                    type="button"
                    className={clsx('btn-toolbar', editMode && 'active')}
                    aria-pressed={editMode}
                    onClick={() => {
                        setEditMode(!editMode);
                        setShowAddForm(false);
                        setEditingId(null);
                    }}
                >
                    {editMode ? <Check size={18} aria-hidden="true" /> : <Edit2 size={18} aria-hidden="true" />}
                    {editMode ? '完成' : '編輯行程'}
                </button>
            </div>

            <DaySelector days={days} selectedDayId={currentDay.id} onSelectDay={setSelectedDayId} startDate={config.startDate} todayISO={today} />

            {uniqueVariants.length > 0 && (
                <div className="variant-tabs" role="group" aria-label="方案">
                    {['ALL', ...uniqueVariants].map((v) => (
                        <button key={v} type="button" className={clsx('toggle-chip', activeVariant === v && 'active')} aria-pressed={activeVariant === v} onClick={() => setVariantFilter(v)}>
                            {v === 'ALL' ? '全部方案' : v}
                        </button>
                    ))}
                </div>
            )}

            {totalMins > 0 && (
                <div className={clsx('time-summary', over && 'over')}>
                    <span>今日預計停留</span>
                    <strong>
                        {Math.floor(totalMins / 60) > 0 ? `${Math.floor(totalMins / 60)} 小時 ` : ''}
                        {totalMins % 60 > 0 ? `${totalMins % 60} 分鐘` : ''}
                        {over ? '（超過 12 小時，行程可能太緊）' : ''}
                    </strong>
                </div>
            )}

            {currentDay.attractions.length === 0 && !showAddForm && (
                <div className="empty-state">
                    <MapPin size={32} aria-hidden="true" />
                    <p>這一天還沒有安排景點。</p>
                    <p className="small">按右上角「編輯行程」就能新增，或用「匯入表格」一次貼上。</p>
                </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visible.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    <div className={clsx('attraction-list', !editMode && 'grid')}>
                        {visible.map((a) => (
                            <SortableAttractionItem
                                key={a.id}
                                attraction={a}
                                editMode={editMode}
                                isEditing={editingId === a.id}
                                defaultRegion={config.defaultRegion}
                                onDelete={(id) => void handleDelete(id)}
                                onEdit={() => setEditingId(a.id)}
                                onSaveEdit={(u) => void handleSaveEdit(u)}
                                onCancelEdit={() => setEditingId(null)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {editMode && !showAddForm && (
                <button type="button" className="btn-dashed" style={{ marginTop: 14 }} onClick={() => setShowAddForm(true)}>
                    <Plus size={20} aria-hidden="true" /> 在這天新增景點
                </button>
            )}
            {showAddForm && (
                <div className="card" style={{ marginTop: 14 }}>
                    <AddAttractionForm onSave={(a) => void handleAdd(a)} onCancel={() => setShowAddForm(false)} />
                </div>
            )}

            {showImportModal && <SpreadsheetImportModal onImport={handleImport} onClose={() => setShowImportModal(false)} />}

            {!editMode && hotels.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <h3 className="section-title" style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>
                        導航回住宿
                    </h3>
                    <div className="link-list">
                        {hotels.map((acc) => (
                            <button key={acc.id} type="button" className="link-btn" onClick={() => openExternal(mapsSearchUrl(acc.address || acc.name))}>
                                <MapPin size={20} aria-hidden="true" /> 返回 {acc.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!editMode && <DailyAdvice tripId={tripId} advice={currentDay.advice} dayIndex={currentIndex} />}
        </div>
    );
}
