import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import { SectionHeader, FilterPills, ConfirmModal, LoadingSkeleton } from '../components/ui';
import type { ShoppingItem, InventoryAction, TabType } from '../types';

export default function ShoppingList({ uid, setInventoryAction, setActiveTab }: {
  uid: string;
  setInventoryAction: (action: InventoryAction | null) => void;
  setActiveTab: (tab: TabType) => void;
}) {
  const { purchaseLocations } = useSettingsContext();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [smartPrompt, setSmartPrompt] = useState<ShoppingItem | null>(null);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'shoppingList'), where('uid', '==', uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ShoppingItem)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (purchaseLocations.length > 0 && !newLocation) {
      setNewLocation(purchaseLocations[0]);
    }
  }, [purchaseLocations]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, 'shoppingList'), {
        uid, name: newItem, location: newLocation || '未分類', checked: false, createdAt: new Date().toISOString()
      });
      setNewItem('');
    } catch (err) {
      console.error('Failed to add shopping item:', err);
    }
  };

  const toggleItem = (item: ShoppingItem) => {
    // Ask first, then delete
    setSmartPrompt(item);
  };

  const confirmToggle = async (addToInventory: boolean) => {
    if (!smartPrompt?.id) return;
    try {
      await deleteDoc(doc(db, 'shoppingList', smartPrompt.id));
      if (addToInventory) {
        setInventoryAction({ type: 'add', name: smartPrompt.name, location: smartPrompt.location });
        setActiveTab('inventory');
      }
    } catch (err) {
      console.error('Failed to remove shopping item:', err);
    }
    setSmartPrompt(null);
  };

  const startEdit = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditLocation(item.location || '');
    setLongPressId(null);
  };

  const saveEdit = async () => {
    if (!editingItem?.id || !editName.trim()) return;
    try {
      await updateDoc(doc(db, 'shoppingList', editingItem.id), { name: editName, location: editLocation });
    } catch (err) {
      console.error('Failed to edit shopping item:', err);
    }
    setEditingItem(null);
  };

  const deleteItem = async (id: string) => {
    try { await deleteDoc(doc(db, 'shoppingList', id)); } catch (err) { console.error(err); }
  };

  const startLongPress = (id: string) => {
    longPressTimer.current = setTimeout(() => setLongPressId(id), 600);
  };
  const endLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const sortedLocations = [...purchaseLocations, '未分類'];
  const groupedItems = items.reduce((acc, item) => {
    const loc = item.location || '未分類';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(item);
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="採購清單" />
        <div className="mt-2">
          <form onSubmit={addItem} className="flex gap-2">
            <div className="flex-1 flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden focus-within:ring-1 focus-within:ring-orange-500">
              <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
                placeholder="食材..." className="flex-1 py-2 px-4 text-xs outline-none bg-transparent" />
              <div className="w-px h-6 bg-gray-100 self-center" />
              <select value={newLocation} onChange={(e) => setNewLocation(e.target.value)}
                className="w-24 py-2 px-3 text-[10px] outline-none bg-transparent appearance-none text-gray-600 font-medium"
              >
                {purchaseLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                <option value="未分類">未分類</option>
              </select>
            </div>
            <button type="submit" className="w-9 h-9 bg-orange-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm active:scale-90 transition-transform">
              <Plus size={18} />
            </button>
          </form>
        </div>
        <FilterPills items={sortedLocations} active={activeLocation} onSelect={setActiveLocation} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {sortedLocations.filter(loc => activeLocation === null || activeLocation === loc).map((location) => {
          const locItems = groupedItems[location];
          if (!locItems || locItems.length === 0) return null;
          return (
            <div key={location} className="space-y-1">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-2 mb-1">{location}</h3>
              <div className="grid grid-cols-3 gap-2">
                {locItems.sort((a, b) => Number(a.checked) - Number(b.checked)).map(item => (
                  <div key={item.id}
                    onMouseDown={() => startLongPress(item.id!)}
                    onMouseUp={endLongPress} onMouseLeave={endLongPress}
                    onTouchStart={() => startLongPress(item.id!)}
                    onTouchEnd={endLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group transition-all active:bg-gray-50 relative select-none"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={(e) => { e.stopPropagation(); toggleItem(item); }} className="shrink-0">
                        {item.checked ? <CheckCircle2 className="text-orange-600" size={16} /> : <Circle className="text-gray-200" size={16} />}
                      </button>
                      <span className={cn("text-[11px] text-gray-700 font-medium truncate", item.checked && "line-through text-gray-400")}>
                        {item.name}
                      </span>
                    </div>

                    {longPressId === item.id && (
                      <div className="absolute inset-0 bg-white/90 rounded-xl flex items-center justify-center z-10 backdrop-blur-[2px] gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                          className="bg-blue-600 text-white px-2 py-1 rounded-full text-[9px] font-bold shadow-lg">編輯</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id!); setLongPressId(null); }}
                          className="bg-red-600 text-white px-2 py-1 rounded-full text-[9px] font-bold shadow-lg">刪除</button>
                        <button onClick={(e) => { e.stopPropagation(); setLongPressId(null); }}
                          className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-[9px] font-bold">取消</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-16 text-gray-300 text-sm">還沒有待採購的食材</div>
        )}
      </div>

      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold mb-4">編輯項目</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">名稱</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">採購地點</label>
                  <select value={editLocation} onChange={e => setEditLocation(e.target.value)}
                    className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500"
                  >
                    {purchaseLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    <option value="未分類">未分類</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingItem(null)} className="flex-1 py-3 text-gray-500 font-medium">取消</button>
                <button onClick={saveEdit} className="flex-1 py-3 bg-orange-600 text-white rounded-full font-bold shadow-lg">儲存</button>
              </div>
            </motion.div>
          </div>
        )}

        {smartPrompt && (
          <ConfirmModal
            title="加入食材庫？"
            message={`要將「${smartPrompt.name}」加入食材管理嗎？`}
            confirmLabel="加入"
            cancelLabel="不用"
            onConfirm={() => confirmToggle(true)}
            onCancel={() => confirmToggle(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
