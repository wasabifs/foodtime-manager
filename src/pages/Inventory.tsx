import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, ShoppingBag, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import { SectionHeader, FilterPills, ConfirmModal, LoadingSkeleton } from '../components/ui';
import type { Ingredient, InventoryAction } from '../types';
import { parseISO } from 'date-fns';

export default function Inventory({ uid, inventoryAction, setInventoryAction }: {
  uid: string;
  inventoryAction: InventoryAction | null;
  setInventoryAction: (action: InventoryAction | null) => void;
}) {
  const { storageLocations, ingredientCategories, purchaseLocations } = useSettingsContext();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [smartPrompt, setSmartPrompt] = useState<Ingredient | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'ingredients'), where('uid', '==', uid), where('isConsumed', '!=', true));
    const unsub = onSnapshot(q, (snapshot) => {
      setIngredients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (inventoryAction?.type === 'add') {
      setEditingIngredient({
        uid, name: inventoryAction.name, purchaseLocation: inventoryAction.location || '',
        expiryDate: '', amount: 1, unit: '份', createdAt: new Date().toISOString()
      } as Ingredient);
      setShowAdd(true);
      setInventoryAction(null);
    }
  }, [inventoryAction, uid, setInventoryAction]);

  const addToShoppingList = async (name: string, purchaseLocation?: string) => {
    try {
      await addDoc(collection(db, 'shoppingList'), {
        uid, name, location: purchaseLocation || '未分類', checked: false, createdAt: new Date().toISOString()
      });
    } catch (err) { console.error('Failed to add to shopping list:', err); }
    setSmartPrompt(null);
  };

  const toggleConsumed = async (ing: Ingredient) => {
    if (!ing.id) return;
    try {
      await updateDoc(doc(db, 'ingredients', ing.id), { isConsumed: true });
      setSmartPrompt(ing);
    } catch (err) { console.error('Failed to mark as consumed:', err); }
  };

  const deleteIngredient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ingredients', id));
      setEditingIngredient(null);
      setShowAdd(false);
    } catch (err) { console.error('Failed to delete ingredient:', err); }
    setConfirmDelete(null);
  };

  const getStatusColor = (expiryDate: string) => {
    if (!expiryDate) return 'bg-white/50';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = parseISO(expiryDate); expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'bg-gray-300/50';
    if (diffDays === 0) return 'bg-red-500/50';
    if (diffDays <= 3) return 'bg-orange-300/50';
    if (diffDays <= 7) return 'bg-yellow-100/50';
    return 'bg-white/50';
  };

  const sortedLocations = [...storageLocations, '未分類'];
  const groupedIngredients = [...ingredients]
    .sort((a, b) => (a.purchaseDate || '0000').localeCompare(b.purchaseDate || '0000'))
    .reduce((acc, ing) => {
      const loc = ing.storageLocation || '未分類';
      if (!acc[loc]) acc[loc] = [];
      acc[loc].push(ing);
      return acc;
    }, {} as Record<string, Ingredient[]>);

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="食材管理" onAdd={() => setShowAdd(true)} />
        <div className="border-b border-gray-100/50">
          <FilterPills items={sortedLocations} active={activeLocation} onSelect={setActiveLocation} allLabel="全部地點" />
        </div>
        <FilterPills items={ingredientCategories} active={activeCategory} onSelect={setActiveCategory} allLabel="全部分類" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-32">
        {sortedLocations.filter(loc => activeLocation === null || activeLocation === loc).map((location) => {
          const locIngs = groupedIngredients[location]?.filter(ing => activeCategory === null || ing.category === activeCategory);
          if (!locIngs || locIngs.length === 0) return null;
          return (
            <div key={location} className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-2">{location}</h3>
              <div className="grid grid-cols-3 gap-2">
                {locIngs.map(ing => (
                  <div key={ing.id} className="relative">
                    <button onClick={() => setEditingIngredient(ing)}
                      className={cn("w-full p-2 rounded-lg shadow-sm flex flex-col relative group min-h-[45px] transition-all active:scale-95 text-left", getStatusColor(ing.expiryDate))}
                    >
                      <h3 className="text-[11px] font-bold mb-0.5 truncate leading-tight text-gray-900 pr-4">{ing.name}</h3>
                      <div className="mt-auto flex items-end justify-between">
                        <span className="text-[8px] font-mono text-gray-600">{ing.expiryDate?.split('-').slice(1).join('/')}</span>
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleConsumed(ing); }}
                      className="absolute top-1 right-1 p-1 text-gray-300 hover:text-orange-600 transition-colors rounded-full"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {ingredients.length === 0 && (
          <div className="text-center py-16 text-gray-300 text-sm">還沒有任何食材</div>
        )}
      </div>

      <AnimatePresence>
        {smartPrompt && (
          <ConfirmModal
            title="加入採購清單？"
            message={`食材已食用完畢。要將「${smartPrompt.name}」加入採購清單嗎？`}
            confirmLabel="加入" cancelLabel="不用"
            onConfirm={() => addToShoppingList(smartPrompt.name, smartPrompt.purchaseLocation)}
            onCancel={() => setSmartPrompt(null)}
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            title="確定刪除？" message="確定要從食材庫中移除此項目嗎？" danger
            confirmLabel="刪除" cancelLabel="取消"
            onConfirm={() => deleteIngredient(confirmDelete)}
            onCancel={() => setConfirmDelete(null)}
          />
        )}
      </AnimatePresence>

      {(showAdd || editingIngredient) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] p-6"
          >
            <h2 className="text-xl font-semibold mb-4">{editingIngredient?.id ? '編輯食材' : '新增食材'}</h2>
            <IngredientForm
              uid={uid} ingredient={editingIngredient || undefined}
              storageLocations={storageLocations} ingredientCategories={ingredientCategories}
              purchaseLocations={purchaseLocations}
              onClose={() => { setShowAdd(false); setEditingIngredient(null); }}
              onDelete={(id) => setConfirmDelete(id)}
            />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Ingredient Form ── */
function IngredientForm({ uid, ingredient, storageLocations, ingredientCategories, purchaseLocations, onClose, onDelete }: {
  uid: string; ingredient?: Ingredient; storageLocations: string[]; ingredientCategories: string[];
  purchaseLocations: string[]; onClose: () => void; onDelete?: (id: string) => void;
}) {
  const [name, setName] = useState(ingredient?.name || '');
  const [purchaseDate, setPurchaseDate] = useState(ingredient?.purchaseDate || new Date().toISOString().slice(0, 10));
  const [purchaseLocation, setPurchaseLocation] = useState(ingredient?.purchaseLocation || '');
  const [expiry, setExpiry] = useState(ingredient?.expiryDate || '');
  const [amount, setAmount] = useState(ingredient?.amount || 1);
  const [unit, setUnit] = useState(ingredient?.unit || '份');
  const [location, setLocation] = useState(ingredient?.storageLocation || storageLocations[0] || '');
  const [category, setCategory] = useState(ingredient?.category || ingredientCategories[0] || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      uid, name, purchaseDate, purchaseLocation, expiryDate: expiry,
      amount: Number(amount), unit, storageLocation: location, category,
      isConsumed: ingredient?.isConsumed || false,
      createdAt: ingredient?.createdAt || new Date().toISOString()
    };
    try {
      if (ingredient?.id) {
        await updateDoc(doc(db, 'ingredients', ingredient.id), data);
      } else {
        await addDoc(collection(db, 'ingredients'), data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save ingredient:', err);
    } finally {
      setSaving(false);
    }
  };

  const addToShoppingList = async () => {
    if (!name) return;
    try {
      await addDoc(collection(db, 'shoppingList'), {
        uid, name, location: purchaseLocation || '未分類', checked: false, createdAt: new Date().toISOString()
      });
      if (ingredient?.id) await deleteDoc(doc(db, 'ingredients', ingredient.id));
      onClose();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="relative">
      {ingredient?.id && (
        <button onClick={addToShoppingList}
          className="absolute -top-12 right-0 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-full shadow-sm hover:bg-gray-50 transition-colors active:scale-95 flex items-center gap-1.5"
        >
          <ShoppingBag size={12} /><span>加入採購清單</span>
        </button>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">食材</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">數量</label>
            <input required type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">單位</label>
            <input required value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">分類</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500">
              {ingredientCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">採購地點</label>
            <select value={purchaseLocation} onChange={e => setPurchaseLocation(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500">
              <option value="">未選擇</option>
              {purchaseLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">儲存區域</label>
            <select value={location} onChange={e => setLocation(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500">
              {storageLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 min-w-0">
            <label className="text-[10px] uppercase font-bold text-gray-400 block">購買日</label>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full min-w-0 p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500 [&::-webkit-date-and-time-value]:text-left" />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[10px] uppercase font-bold text-gray-400 block">到期日</label>
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="w-full min-w-0 p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500 [&::-webkit-date-and-time-value]:text-left" />
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-4">
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-gray-500 text-sm font-medium">取消</button>
            <button type="submit" disabled={saving} className="flex-1 py-4 bg-orange-600 text-white rounded-full text-sm font-medium shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
          {ingredient?.id && onDelete && (
            <button type="button" onClick={() => onDelete(ingredient.id!)}
              className="w-full py-3 text-red-500 text-sm font-bold border border-red-100 rounded-xl active:bg-red-50">刪除食材</button>
          )}
        </div>
      </form>
    </div>
  );
}
