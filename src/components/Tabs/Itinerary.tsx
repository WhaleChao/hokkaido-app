import { useState, useEffect } from 'react';
import { DaySelector } from '../DaySelector';
import { AttractionCard } from '../AttractionCard';
import { DailyAdvice } from '../DailyAdvice';
import { useItinerary } from '../../hooks/useItinerary';
import { AddAttractionForm } from './AddAttractionForm';
import { Edit2, Plus, X, FileUp, GripVertical, MapPin } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type DayItinerary, type Attraction } from '../../data/itinerary';
import { parseSpreadsheetData } from '../../utils/parser';
import { SpreadsheetImportModal } from '../SpreadsheetImportModal';
import { useConfigStore } from '../../hooks/useConfigStore';

function SortableAttractionItem({
    attraction,
    editMode,
    onDelete,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    isEditing,
    defaultRegion,
    onAutoSave
}: {
    attraction: Attraction;
    editMode: boolean;
    onDelete: (id: string) => void;
    onEdit: () => void;
    onSaveEdit: (updated: Attraction) => void;
    onCancelEdit: () => void;
    onAutoSave?: (updated: Attraction) => void;
    isEditing: boolean;
    defaultRegion?: string;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: attraction.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: transform ? 1 : 0,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="attraction-wrapper">
            {editMode && (
                <div
                    {...attributes}
                    {...listeners}
                    style={{ position: 'absolute', left: '-5px', top: '50%', transform: 'translateY(-50%)', cursor: 'grab', color: '#ccc', padding: '10px', zIndex: 10, touchAction: 'none' }}
                >
                    <GripVertical size={24} />
                </div>
            )}
            <div style={{ marginLeft: editMode ? '25px' : '0', transition: 'margin 0.3s' }}>
                {isEditing ? (
                    <div style={{ marginBottom: '16px', backgroundColor: 'var(--snow-white)', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--fuji-blue-light)' }}>
                        <AddAttractionForm
                            editAttraction={attraction}
                            onSave={onSaveEdit}
                            onCancel={onCancelEdit}
                            onAutoSave={onAutoSave}
                        />
                    </div>
                ) : (
                    <AttractionCard attraction={attraction} defaultRegion={defaultRegion} />
                )}
            </div>
            {editMode && !isEditing && (
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', display: 'flex', gap: '8px', zIndex: 20 }}>
                    <button
                        className="btn-action-circle edit"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="編輯此景點"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        className="btn-action-circle delete"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(attraction.id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="移除此景點"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}

export function Itinerary({ tripId }: { tripId: string }) {
    const { config } = useConfigStore(tripId);
    const { days, loading, saveDay } = useItinerary(tripId);
    const [selectedDayId, setSelectedDayId] = useState<string>('');
    const [editMode, setEditMode] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Phase 14 extensions
    const [editingAttractionId, setEditingAttractionId] = useState<string | null>(null);
    const [planVariantFilter, setPlanVariantFilter] = useState<string>('ALL');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (days.length > 0 && !selectedDayId) {
            setSelectedDayId(days[0].id);
        }
    }, [days, selectedDayId]);

    if (loading) return <div className="tab-placeholder fade-in">載入行程中...</div>;
    if (!days.length) return <div className="tab-placeholder fade-in">目前沒有行程</div>;

    const currentDay = days.find(d => d.id === selectedDayId) || days[0];

    const handleAddAttraction = (attraction: Attraction) => {
        const updatedAttractions = [...currentDay.attractions, attraction];
        const updatedDay: DayItinerary = { ...currentDay, attractions: updatedAttractions };
        saveDay(updatedDay);
        setShowAddForm(false);
    };

    const handleSaveEditAttraction = (updatedAttraction: Attraction) => {
        const updatedAttractions = currentDay.attractions.map(a =>
            a.id === updatedAttraction.id ? updatedAttraction : a
        );
        const updatedDay: DayItinerary = { ...currentDay, attractions: updatedAttractions };
        saveDay(updatedDay);
        setEditingAttractionId(null);
    };

    const handleDeleteAttraction = (attractionId: string) => {
        if (!window.confirm('確定要刪除此景點嗎？')) return;
        const updatedAttractions = currentDay.attractions.filter(a => a.id !== attractionId);
        const updatedDay: DayItinerary = { ...currentDay, attractions: updatedAttractions };
        saveDay(updatedDay);
    };

    const handleImportSpreadsheet = async (tsvData: string) => {
        const newDays = parseSpreadsheetData(tsvData, days);
        // Save all updated days back to IndexedDB
        for (const day of newDays) {
            await saveDay(day);
        }
        alert('解析與匯入完成！');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = currentDay.attractions.findIndex(a => a.id === active.id);
            const newIndex = currentDay.attractions.findIndex(a => a.id === over.id);
            const reordered = arrayMove(currentDay.attractions, oldIndex, newIndex);
            saveDay({ ...currentDay, attractions: reordered });
        }
    };

    const uniqueVariants = Array.from(new Set(
        currentDay.attractions
            .map(a => a.planVariant?.trim())
            .filter(Boolean)
    )) as string[];

    const hasPlanVariants = uniqueVariants.length > 0;
    const filteredAttractions = currentDay.attractions.filter(a => {
        if (!hasPlanVariants || planVariantFilter === 'ALL') return true;
        // If an item doesn't have a planVariant selected, show it universally
        if (!a.planVariant?.trim()) return true;
        return a.planVariant.trim() === planVariantFilter;
    });

    return (
        <div className="itinerary-view fade-in">
            <div className="itinerary-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                    className={`btn-toggle-edit`}
                    style={{ backgroundColor: 'white', color: 'var(--text-main)', border: '1px solid #ddd', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setShowImportModal(true)}
                    title="從 Excel / Sheets 匯入"
                >
                    <FileUp size={20} />
                </button>
                <button
                    className={`btn-toggle-edit ${editMode ? 'active' : ''}`}
                    onClick={() => {
                        setEditMode(!editMode);
                        if (editMode) {
                            setShowAddForm(false);
                        }
                    }}
                >
                    {editMode ? <X size={16} /> : <Edit2 size={16} />}
                    {editMode ? '完成編輯' : '編輯行程'}
                </button>
            </div>

            <DaySelector
                days={days}
                selectedDayId={selectedDayId || currentDay.id}
                onSelectDay={setSelectedDayId}
            />

            {/* N-Plan Tabs */
                hasPlanVariants && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                        {['ALL', ...uniqueVariants].map(variant => (
                            <button
                                key={variant}
                                onClick={() => setPlanVariantFilter(variant)}
                                style={{
                                    padding: '8px 24px',
                                    borderRadius: '24px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s',
                                    border: planVariantFilter === variant ? 'none' : '1px solid #ddd',
                                    backgroundColor: planVariantFilter === variant ? 'var(--fuji-blue)' : 'white',
                                    color: planVariantFilter === variant ? 'white' : 'var(--text-light)',
                                    boxShadow: planVariantFilter === variant ? '0 4px 12px rgba(52, 88, 153, 0.3)' : 'none'
                                }}
                            >
                                {variant === 'ALL' ? '不分方案' : `${variant}`}
                            </button>
                        ))}
                    </div>
                )}

            {/* Duration Calculation & Warning */}
            {(() => {
                const totalMins = currentDay.attractions.reduce((sum, attr) => sum + (attr.durationMinutes || 0), 0);
                const hrs = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                const isOverpacked = totalMins > 720; // 12 hours

                if (totalMins === 0) return null;

                return (
                    <div style={{ padding: '0 16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isOverpacked ? 'rgba(255, 165, 0, 0.1)' : 'var(--snow-white)', padding: '12px 16px', borderRadius: '12px', border: isOverpacked ? '1px solid orange' : '1px solid #eee' }}>
                            <span style={{ fontSize: '0.85rem', color: isOverpacked ? 'orange' : 'var(--text-light)', fontWeight: isOverpacked ? 600 : 400 }}>
                                今日累積停留時間
                            </span>
                            <span style={{ fontSize: '1rem', color: isOverpacked ? 'orange' : 'var(--text-main)', fontWeight: 600 }}>
                                {hrs > 0 ? `${hrs} 小時 ` : ''}{mins > 0 ? `${mins} 分鐘` : ''}
                            </span>
                        </div>
                        {isOverpacked && (
                            <p style={{ color: 'orange', fontSize: '0.75rem', marginTop: '6px', textAlign: 'right' }}>
                                ⚠️ 警告：超過 12 小時，行程可能過於緊湊！
                            </p>
                        )}
                    </div>
                );
            })()}
            <div className={`itinerary-list ${!editMode ? 'desktop-grid' : ''}`}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredAttractions.map(a => a.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {filteredAttractions.map(attraction => (
                            <SortableAttractionItem
                                key={attraction.id}
                                attraction={attraction}
                                editMode={editMode}
                                onDelete={handleDeleteAttraction}
                                onEdit={() => setEditingAttractionId(attraction.id)}
                                onSaveEdit={handleSaveEditAttraction}
                                onCancelEdit={() => setEditingAttractionId(null)}
                                onAutoSave={(updated) => {
                                    const updatedAttractions = currentDay.attractions.map(a =>
                                        a.id === updated.id ? updated : a
                                    );
                                    saveDay({ ...currentDay, attractions: updatedAttractions });
                                }}
                                isEditing={editingAttractionId === attraction.id}
                                defaultRegion={config.defaultRegion}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            {editMode && !showAddForm && (
                <button
                    className="btn-add-attraction fade-in"
                    onClick={() => setShowAddForm(true)}
                >
                    <Plus size={20} /> 在這天新增景點
                </button>
            )}

            {showAddForm && (
                <AddAttractionForm
                    onSave={handleAddAttraction}
                    onCancel={() => setShowAddForm(false)}
                />
            )}

            {showImportModal && (
                <SpreadsheetImportModal
                    onImport={(tsvData) => {
                        handleImportSpreadsheet(tsvData);
                        setShowImportModal(false);
                    }}
                    onClose={() => setShowImportModal(false)}
                />
            )}

            {!editMode && config.accommodations && config.accommodations.length > 0 && (
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {config.accommodations.filter(acc => {
                        // If the accommodation has no date bounds, it applies universally
                        if (!acc.checkIn || !acc.checkOut) return true;

                        // Compare string dates lexicographically (YYYY-MM-DD works natively)
                        return currentDay.date >= acc.checkIn && currentDay.date <= acc.checkOut;
                    }).map((acc, index) => (
                        <div key={acc.id}>
                            {index === 0 && <h4 style={{ fontSize: '0.95rem', color: 'var(--text-light)', paddingLeft: '8px', marginBottom: '12px' }}>導航回住宿</h4>}
                            <button
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(acc.address)}`, '_blank')}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'var(--snow-white)',
                                    border: '1px solid var(--fuji-blue-light)',
                                    padding: '16px',
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    color: 'var(--fuji-blue)',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(52, 88, 153, 0.1)'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} /> 返回 {acc.name}</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {!editMode && (
                <DailyAdvice
                    tripId={tripId}
                    advice={currentDay.advice}
                    dayIndex={Math.max(0, days.findIndex(d => d.id === currentDay.id))}
                />
            )}
        </div>
    );
}
