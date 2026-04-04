import { useState, useRef } from 'react';
import { Plus, X, Check, GripVertical } from 'lucide-react';
import { motion, Reorder } from 'motion/react';
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
export function LocationManager({ type, locations, onClose }: {
  type: LocationType; locations: string[]; onClose: () => void;
}) {
  const { updateLocations } = useSettingsContext();
  const [newLoc, setNewLoc] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [longPressIdx, setLongPressIdx] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

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

  const removeLocation = (idx: number) => {
    saveLocations(locations.filter((_, i) => i !== idx));
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditVal(locations[idx]);
  };

  const saveEdit = () => {
    if (!editVal.trim()) return;
    const updated = [...locations];
    updated[editingIdx!] = editVal.trim();
    saveLocations(updated);
    setEditingIdx(null);
  };

  const startLongPress = (idx: number) => {
    longPressTimer.current = setTimeout(() => setLongPressIdx(idx), 600);
  };

  const endLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="sticky top-0 bg-white z-10 px-4 pt-6 pb-2 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">{LOCATION_TYPE_LABELS[type]}</h2>
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
                onMouseDown={() => startLongPress(idx)}
                onMouseUp={endLongPress}
                onMouseLeave={endLongPress}
                onTouchStart={() => startLongPress(idx)}
                onTouchEnd={endLongPress}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-xl border border-gray-100 group cursor-grab active:cursor-grabbing relative overflow-hidden"
              >
                <div className="flex items-center gap-2 flex-1">
                  <GripVertical size={14} className="text-gray-300" />
                  {editingIdx === idx ? (
                    <div className="flex-1 flex gap-2">
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEdit()}
                        className="flex-1 bg-white border border-orange-200 rounded-lg px-2 py-1 text-xs outline-none"
                      />
                      <button onClick={saveEdit} className="p-1 bg-orange-600 text-white rounded-lg shadow-sm">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-700">{loc}</span>
                  )}
                </div>

                {longPressIdx === idx && editingIdx !== idx && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(idx); setLongPressIdx(null); }}
                      className="bg-orange-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg">編輯</button>
                    <button onClick={(e) => { e.stopPropagation(); removeLocation(idx); setLongPressIdx(null); }}
                      className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg">刪除</button>
                    <button onClick={(e) => { e.stopPropagation(); setLongPressIdx(null); }}
                      className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold">取消</button>
                  </div>
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
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
