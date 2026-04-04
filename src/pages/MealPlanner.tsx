import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ShoppingBag, BookOpen, Check, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import { SectionHeader, FilterPills, LoadingSkeleton } from '../components/ui';
import type { Ingredient, Recipe, MealPlan, MealType, MealItem } from '../types';
import { MEAL_LABELS } from '../types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';

/* ── Meal Input with autocomplete ── */
function MealInput({ onSave, recipes, onSelectRecipe }: {
  onSave: (val: string) => void; recipes: Recipe[]; onSelectRecipe: (r: Recipe) => void;
}) {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filtered = value ? recipes.filter(r => r.title.toLowerCase().includes(value.toLowerCase())).slice(0, 5) : [];

  return (
    <div className="relative flex items-center">
      <input placeholder="輸入菜色名稱..." value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onSave(value); setValue(''); setShowSuggestions(false); } }}
        onBlur={() => { if (value.trim()) { onSave(value); setValue(''); } setTimeout(() => setShowSuggestions(false), 200); }}
        onFocus={() => setShowSuggestions(true)}
        className="bg-transparent border-none p-0 focus:ring-0 placeholder:text-gray-300 w-24"
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-30 min-w-[160px] overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 text-[8px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">推薦食譜</div>
          {filtered.map(r => (
            <button key={r.id}
              onMouseDown={(e) => { e.preventDefault(); onSelectRecipe(r); setValue(''); setShowSuggestions(false); }}
              className="w-full text-left px-3 py-2.5 text-[10px] hover:bg-orange-50 text-gray-700 border-b border-gray-50 last:border-none flex items-center gap-2"
            >
              <BookOpen size={10} className="text-orange-400" />
              <span className="font-medium">{r.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main MealPlanner Page ── */
export default function MealPlanner({ uid }: { uid: string }) {
  const { recipeCategories, purchaseLocations } = useSettingsContext();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showRecipePicker, setShowRecipePicker] = useState<{ type: MealType } | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncItems, setSyncItems] = useState<{ name: string; amount: string; selected: boolean; inStock: boolean; location: string }[]>([]);

  useEffect(() => {
    const qP = query(collection(db, 'mealPlans'), where('uid', '==', uid));
    const unsubP = onSnapshot(qP, (snapshot) => {
      setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MealPlan)));
      setLoading(false);
    }, () => setLoading(false));

    const qR = query(collection(db, 'recipes'), where('uid', '==', uid));
    const unsubR = onSnapshot(qR, (snapshot) => {
      setRecipes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)));
    });

    const qI = query(collection(db, 'ingredients'), where('uid', '==', uid), where('isConsumed', '==', false));
    const unsubI = onSnapshot(qI, (snapshot) => {
      setInventory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient)));
    });

    return () => { unsubP(); unsubR(); unsubI(); };
  }, [uid]);

  const currentPlan = plans.find(p => p.date === selectedDate);

  const getMealItems = (type: MealType): MealItem[] => {
    if (!currentPlan) return [];
    const items = currentPlan[type];
    return Array.isArray(items) ? items : [];
  };

  const toggleRecipe = async (type: MealType, recipe: Recipe) => {
    const currentItems = getMealItems(type);
    const exists = currentItems.some(i => i.recipeId === recipe.id);
    const newItems = exists
      ? currentItems.filter(i => i.recipeId !== recipe.id)
      : [...currentItems, { name: recipe.title, recipeId: recipe.id }];

    try {
      if (currentPlan) {
        await updateDoc(doc(db, 'mealPlans', currentPlan.id!), { [type]: newItems });
      } else {
        await addDoc(collection(db, 'mealPlans'), { uid, date: selectedDate, [type]: newItems, createdAt: new Date().toISOString() });
      }
    } catch (err) { console.error('Failed to toggle recipe:', err); }
  };

  const addManualMeal = async (type: MealType, name: string) => {
    if (!name.trim()) return;
    const newItems = [...getMealItems(type), { name: name.trim() }];
    try {
      if (currentPlan) {
        await updateDoc(doc(db, 'mealPlans', currentPlan.id!), { [type]: newItems });
      } else {
        await addDoc(collection(db, 'mealPlans'), { uid, date: selectedDate, [type]: newItems, createdAt: new Date().toISOString() });
      }
    } catch (err) { console.error('Failed to add meal:', err); }
  };

  const removeMealItem = async (type: MealType, index: number) => {
    if (!currentPlan) return;
    const newItems = getMealItems(type).filter((_, i) => i !== index);
    try {
      await updateDoc(doc(db, 'mealPlans', currentPlan.id!), { [type]: newItems });
    } catch (err) { console.error('Failed to remove meal item:', err); }
  };

  const syncShoppingList = async () => {
    if (!currentPlan) return;
    setIsSyncing(true);
    try {
      const recipeIds = new Set<string>();
      (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).forEach(type => {
        getMealItems(type).forEach(item => { if (item.recipeId) recipeIds.add(item.recipeId); });
      });

      if (recipeIds.size === 0) { setIsSyncing(false); return; }

      const requiredIngredients: { name: string; amount: string }[] = [];
      recipeIds.forEach(id => {
        const recipe = recipes.find(r => r.id === id);
        if (recipe) requiredIngredients.push(...recipe.ingredients);
      });

      const items = requiredIngredients.map(req => {
        const inStock = inventory.some(inv =>
          inv.name.toLowerCase().includes(req.name.toLowerCase()) ||
          req.name.toLowerCase().includes(inv.name.toLowerCase())
        );
        return { name: req.name, amount: req.amount, selected: !inStock, inStock, location: '未分類' };
      });

      setSyncItems(items);
      setShowSyncModal(true);
    } catch (error) {
      console.error('Sync analysis failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmSync = async () => {
    const selectedItems = syncItems.filter(i => i.selected);
    if (selectedItems.length === 0) { setShowSyncModal(false); return; }

    setIsSyncing(true);
    try {
      const qSL = query(collection(db, 'shoppingList'), where('uid', '==', uid));
      const slSnapshot = await getDocs(qSL);
      const currentSLNames = slSnapshot.docs.map(d => d.data().name.toLowerCase());

      const batch = writeBatch(db);
      let addedCount = 0;

      selectedItems.forEach(ing => {
        if (!currentSLNames.includes(ing.name.toLowerCase())) {
          const newDocRef = doc(collection(db, 'shoppingList'));
          batch.set(newDocRef, {
            uid, name: ing.name, location: ing.location, checked: false,
            createdAt: new Date().toISOString(), note: `來自週計畫: ${ing.amount}`
          });
          addedCount++;
        }
      });

      if (addedCount > 0) await batch.commit();
      setShowSyncModal(false);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="每日菜單"
          extraAction={
            <button onClick={syncShoppingList} disabled={isSyncing || !currentPlan}
              className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-orange-200 transition-colors disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <ShoppingBag size={12} />}
              {isSyncing ? '分析中...' : '自動採購'}
            </button>
          }
        />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 flex justify-between bg-white p-0.5 rounded-xl border border-orange-50 shadow-sm">
            {weekDays.map(date => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const isActive = selectedDate === dateStr;
              return (
                <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                  className={cn("flex flex-col items-center flex-1 py-1 rounded-lg transition-all",
                    isActive ? "bg-orange-600 text-white shadow-sm" : "text-gray-400 hover:bg-orange-50"
                  )}
                >
                  <span className="text-[6px] uppercase font-bold mb-0">{format(date, 'EEE')}</span>
                  <span className="text-[9px] font-sans font-bold leading-tight">{format(date, 'M/d')}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((meal) => (
          <div key={meal} className="bg-white p-3 rounded-xl shadow-sm border border-orange-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] uppercase font-bold tracking-widest text-gray-400">{MEAL_LABELS[meal]}</span>
              <button onClick={() => setShowRecipePicker({ type: meal })}
                className="text-orange-600 text-[8px] font-bold bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm active:scale-95 transition-transform"
              >從食譜選擇</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getMealItems(meal).map((item, idx) => (
                <div key={idx} className="flex items-center group/item relative">
                  {item.recipeId ? (
                    <button onClick={() => { const r = recipes.find(r => r.id === item.recipeId); if (r) setViewingRecipe(r); }}
                      className="bg-orange-50 text-orange-600 px-2 py-1 rounded-lg text-[10px] font-bold border border-orange-100 hover:bg-orange-100 transition-colors pr-6"
                    >{item.name}</button>
                  ) : (
                    <div className="bg-gray-50 text-gray-700 px-2 py-1 rounded-lg text-[10px] font-medium border border-gray-100 flex items-center pr-6">{item.name}</div>
                  )}
                  <button onClick={() => removeMealItem(meal, idx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 p-0.5">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <div className="bg-gray-50 text-gray-700 px-2 py-1 rounded-lg text-[10px] font-medium border border-gray-100 flex items-center relative group">
                <MealInput onSave={(val) => addManualMeal(meal, val)} recipes={recipes} onSelectRecipe={(r) => toggleRecipe(meal, r)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recipe Viewer */}
      <AnimatePresence>
        {viewingRecipe && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 max-h-[85vh] overflow-y-auto relative shadow-2xl"
            >
              <button onClick={() => setViewingRecipe(null)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
              {viewingRecipe.images?.[0] && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden mb-6 shadow-sm">
                  <img src={viewingRecipe.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{viewingRecipe.title}</h2>
              {viewingRecipe.description && <p className="text-sm text-gray-500 mb-6 leading-relaxed">{viewingRecipe.description}</p>}
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-orange-600 mb-3 tracking-widest">所需食材</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {viewingRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="text-xs bg-orange-50/50 p-3 rounded-xl flex justify-between border border-orange-100/50">
                        <span className="text-gray-700">{ing.name}</span>
                        <span className="font-bold text-orange-600">{ing.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-orange-600 mb-3 tracking-widest">料理步驟</h4>
                  <div className="space-y-4">
                    {viewingRecipe.steps.map((step, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                        <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipe Picker Modal */}
      <AnimatePresence>
        {showRecipePicker && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">選擇食譜</h2>
                <button onClick={() => setShowRecipePicker(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <FilterPills items={recipeCategories} active={pickerCategory} onSelect={setPickerCategory} />
              <div className="grid grid-cols-3 gap-3 mt-4">
                {recipes.filter(r => !pickerCategory || r.category === pickerCategory).map(recipe => {
                  const currentItems = getMealItems(showRecipePicker.type);
                  const isSelected = currentItems.some(i => i.recipeId === recipe.id);
                  return (
                    <button key={recipe.id} onClick={() => toggleRecipe(showRecipePicker.type, recipe)}
                      className={cn("p-2 rounded-2xl text-left transition-all border-2 flex flex-col",
                        isSelected ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-transparent hover:bg-gray-100"
                      )}
                    >
                      <div className="aspect-square bg-gray-200 rounded-xl mb-2 overflow-hidden relative">
                        {recipe.images?.[0] && <img src={recipe.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                        {isSelected && (
                          <div className="absolute inset-0 bg-orange-600/20 flex items-center justify-center">
                            <Check className="text-white" size={20} />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold truncate block text-center">{recipe.title}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowRecipePicker(null)} className="w-full py-4 bg-orange-600 text-white rounded-full font-bold mt-6 shadow-lg active:scale-95 transition-transform">完成</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Modal */}
      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-orange-100"
            >
              <div className="p-6 text-center bg-orange-50/50">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag className="text-orange-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">自動採購分析</h3>
                <p className="text-xs text-gray-500 mt-1">{selectedDate} 所需食材</p>
              </div>
              <div className="max-h-[350px] overflow-y-auto p-4 space-y-1.5">
                {syncItems.length > 0 ? syncItems.map((item, idx) => (
                  <div key={idx} className={cn("flex justify-between items-center py-1.5 px-3 rounded-xl border transition-all",
                    item.selected ? "bg-orange-50/50 border-orange-200" : "bg-gray-50 border-gray-100"
                  )}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={() => { const n = [...syncItems]; n[idx].selected = !n[idx].selected; setSyncItems(n); }}
                        className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                          item.selected ? "bg-orange-600 border-orange-600" : "bg-white border-gray-300"
                        )}
                      >{item.selected && <Check size={10} className="text-white" />}</button>
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-gray-700 truncate">{item.name}</span>
                        <span className="text-[9px] text-gray-400 font-medium shrink-0">({item.amount})</span>
                      </div>
                      {item.inStock && <span className="text-[9px] font-bold text-green-600 bg-green-100/50 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">庫存充足</span>}
                    </div>
                    {item.selected && (
                      <select value={item.location} onChange={(e) => { const n = [...syncItems]; n[idx].location = e.target.value; setSyncItems(n); }}
                        className="text-[9px] font-bold text-orange-600 bg-orange-100/50 px-2 py-0.5 rounded-md ml-2 border-none outline-none focus:ring-0 cursor-pointer max-w-[80px]"
                      >
                        <option value="未分類">地點</option>
                        {purchaseLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                    )}
                  </div>
                )) : <div className="text-center py-12 text-gray-400 text-sm">沒有找到所需食材</div>}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setShowSyncModal(false)} className="flex-1 py-3 text-gray-500 text-sm font-bold active:scale-95 transition-transform">取消</button>
                <button onClick={confirmSync} disabled={isSyncing || syncItems.filter(i => i.selected).length === 0}
                  className="flex-2 py-3 bg-orange-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isSyncing ? '處理中...' : `加入清單 (${syncItems.filter(i => i.selected).length})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
