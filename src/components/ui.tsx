import { useState } from 'react';
import { Plus, X, Check, GripVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import type { LocationType } from '../types';
import { LOCATION_TYPE_LABELS } from '../types';
import type { LucideIcon } from 'lucide-react';

/* ── Tab Button ── */
export function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: LucideIcon; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-2 px-4 flex-1 transition-all duration-200",
        active ? "text-orange-600 border-t-2 border-orange-600" : "text-gray-500 hover:text-orange-400"
      )}
    >
      <Icon size={20} className={cn("mb-1", active && "scale-110")} />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );
}

/* ── Section Header ── */
export function SectionHeader({ title, onAdd, extraAction }: {
  title: string; onAdd?: () => void; extraAction?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2 px-6 pt-0 pb-2">
      <h1 className="text-lg font-sans font-bold text-gray-900 tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">
        {extraAction}
        {onAdd && (
          <button
            onClick={onAdd}
            className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-sm hover:bg-orange-700 transition-colors active:scale-90"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Filter Pills ── */
export function FilterPills({ items, active, onSelect, allLabel = '全部' }: {
  items: string[]; active: string | null; onSelect: (val: string | null) => void; allLabel?: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all",
          active === null ? "bg-orange-600 text-white shadow-md" : "bg-white text-gray-400 border border-gray-100"
        )}
      >
        {allLabel}
      </button>
      {items.map(item => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all",
            active === item ? "bg-orange-600 text-white shadow-md" : "bg-white text-gray-400 border border-gray-100"
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/* ── Confirm Modal (replaces native confirm/alert) ── */
export function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = '確定', cancelLabel = '取消', danger = false }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
  confirmLabel?: string; cancelLabel?: string; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white/90 backdrop-blur-xl w-full max-w-[280px] rounded-[20px] shadow-2xl overflow-hidden border border-white/20"
      >
        <div className="p-5 text-center">
          <p className="text-base font-semibold text-gray-900 mb-1">{title}</p>
          <p className="text-xs text-gray-500">{message}</p>
        </div>
        <div className="flex border-t border-gray-200">
          <button onClick={onCancel} className="flex-1 py-3 text-sm font-medium text-gray-500 border-r border-gray-200 active:bg-gray-100">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={cn("flex-1 py-3 text-sm font-bold active:bg-gray-100", danger ? "text-red-500" : "text-blue-500")}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Toast notification ── */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl z-[80] max-w-[300px] text-center"
      onClick={onClose}
    >
      {message}
    </motion.div>
  );
}

/* ── Loading Skeleton ── */
export function LoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden p-4 space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="animate-pulse flex gap-3">
          <div className="bg-gray-200 rounded-xl h-12 flex-1" />
          <div className="bg-gray-200 rounded-xl h-12 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ── Location Manager Modal ── */
// 各分類型別對應到需要連動更新的 Firestore 集合與欄位
const CASCADE_TARGETS: Record<LocationType, { col: string; field: string }[]> = {
  purchase: [
    { col: 'shoppingList', field: 'location' },
    { col: 'ingredients', field: 'purchaseLocation' },
  ],
  ingredient: [{ col: 'ingredients', field: 'category' }],
  storage: [{ col: 'ingredients', field: 'storageLocation' }],
  recipe: [{ col: 'recipes', field: 'category' }],
};

export function LocationManager({ type, locations, uid, onClose }: {
  type: LocationType; locations: string[]; uid: string; onClose: () => void;
}) {
  const { updateLocations } = useSettingsContext();
  const [newLoc, setNewLoc] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 將既有資料中使用 oldName 的欄位批次改為 newName
  const cascadeUpdate = async (oldName: string, newName: string) => {
    for (const { col, field } of CASCADE_TARGETS[type]) {
      const snap = await getDocs(query(collection(db, col), where('uid', '==', uid), where(field, '==', oldName)));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { [field]: newName }));
      await batch.commit();
    }
  };

  const saveLocations = async (newLocations: string[]) => {
    setSaving(true);
    try {
      await updateLocations(type, newLocations);
    } catch {
      // error handled in hook
    } finally {
      setSaving(false);
    }
  };

  const addLocation = () => {
    if (!newLoc.trim() || locations.includes(newLoc.trim())) return;
    saveLocations([...locations, newLoc.trim()]);
    setNewLoc('');
  };

  const removeLocation = async (idx: number) => {
    const name = locations[idx];
    setConfirmDeleteIdx(null);
    setSaving(true);
    try {
      await cascadeUpdate(name, '未分類');
      await updateLocations(type, locations.filter((_, i) => i !== idx));
    } catch (err) {
      console.error('Failed to delete location:', err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditVal(locations[idx]);
  };

  const saveEdit = async () => {
    const newName = editVal.trim();
    const oldName = locations[editingIdx!];
    if (!newName || newName === oldName) { setEditingIdx(null); return; }
    if (locations.includes(newName)) return; // 重複名稱不允許
    setEditingIdx(null);
    setSaving(true);
    try {
      const updated = [...locations];
      updated[locations.indexOf(oldName)] = newName;
      await updateLocations(type, updated);
      await cascadeUpdate(oldName, newName);
    } catch (err) {
      console.error('Failed to rename location:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="sticky top-0 bg-white z-10 px-4 pt-6 pb-2 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{LOCATION_TYPE_LABELS[type]}</h2>
            {saving && <Loader2 size={14} className="animate-spin text-orange-600" />}
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-2">
            <input
              type="text" value={newLoc} onChange={e => setNewLoc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLocation()}
              placeholder="新增名稱..."
              className="flex-1 p-2.5 bg-gray-50 rounded-xl text-xs border-none outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button onClick={addLocation} disabled={saving}
              className="w-9 h-9 bg-orange-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm active:scale-90 transition-transform disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>

          <Reorder.Group axis="y" values={locations} onReorder={saveLocations} className="space-y-2">
            {locations.map((loc, idx) => (
              <Reorder.Item
                key={loc} value={loc}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  {editingIdx === idx ? (
                    <div className="flex-1 flex gap-2">
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="flex-1 min-w-0 bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs outline-none"
                      />
                      <button onClick={saveEdit} className="p-1 bg-orange-600 text-white rounded-lg shadow-sm shrink-0">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingIdx(null)} className="p-1 bg-gray-200 text-gray-500 rounded-lg shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-700 truncate">{loc}</span>
                  )}
                </div>

                {editingIdx !== idx && (
                  <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    <button disabled={saving}
                      onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-orange-600 active:text-orange-600 transition-colors disabled:opacity-40"
                    >
                      <Pencil size={14} />
                    </button>
                    <button disabled={saving}
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteIdx(idx); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-red-500 active:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>

        <AnimatePresence>
          {confirmDeleteIdx !== null && (
            <ConfirmModal
              title={`刪除「${locations[confirmDeleteIdx]}」？`}
              message="使用此分類的既有資料會改為「未分類」。" danger
              confirmLabel="刪除" cancelLabel="取消"
              onConfirm={() => removeLocation(confirmDeleteIdx)}
              onCancel={() => setConfirmDeleteIdx(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ── App Logo ── */
export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/icons/icon-192x192.png"
      alt="食刻管理"
      width={size}
      height={size}
      className="rounded-2xl"
      style={{ width: size, height: size }}
    />
  );
}
