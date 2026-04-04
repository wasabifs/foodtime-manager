import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Plus, Sparkles, X, Camera, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useImageUpload } from '../hooks/useImageUpload';
import { SectionHeader, FilterPills, ConfirmModal, LoadingSkeleton } from '../components/ui';
import type { Ingredient, Recipe } from '../types';
import { parseISO } from 'date-fns';
import { GoogleGenAI, Type } from '@google/genai';

/* ── Recipe Detail Modal ── */
function RecipeDetail({ recipe, onClose, onDelete, onEdit }: {
  recipe: Recipe; onClose: () => void;
  onDelete?: (id: string) => void; onEdit?: (recipe: Recipe) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-[32px] p-8 max-h-[85vh] overflow-y-auto relative shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={24} />
        </button>

        {recipe.images?.[0] && (
          <div className="aspect-video w-full rounded-2xl overflow-hidden mb-6 shadow-sm">
            <img src={recipe.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{recipe.title}</h2>
        {recipe.description && <p className="text-sm text-gray-500 mb-6 leading-relaxed">{recipe.description}</p>}

        <div className="space-y-6">
          <div>
            <h4 className="text-[10px] uppercase font-bold text-orange-600 mb-3 tracking-widest">所需食材</h4>
            <div className="grid grid-cols-2 gap-2">
              {recipe.ingredients.map((ing, i) => (
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
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                  <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
            {onEdit && (
              <button onClick={() => onEdit(recipe)} className="flex-1 py-4 bg-gray-50 text-gray-600 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors">編輯</button>
            )}
            {onDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-full text-sm font-bold hover:bg-red-100 transition-colors">刪除</button>
            )}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm && onDelete && (
          <ConfirmModal
            title="確定刪除？" message="確定要刪除此食譜嗎？此操作無法復原。" danger
            confirmLabel="刪除" cancelLabel="取消"
            onConfirm={() => { onDelete(recipe.id!); setShowDeleteConfirm(false); }}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Recipe Form with fixed upload ── */
function RecipeForm({ uid, recipe, categories, onClose }: {
  uid: string; recipe?: Recipe; categories: string[]; onClose: () => void;
}) {
  const [title, setTitle] = useState(recipe?.title || '');
  const [desc, setDesc] = useState(recipe?.description || '');
  const [category, setCategory] = useState(recipe?.category || categories[0] || '');
  const [imageUrl, setImageUrl] = useState(recipe?.images?.[0] || '');
  const [ingredients, setIngredients] = useState(recipe?.ingredients || [{ name: '', amount: '' }]);
  const [steps, setSteps] = useState(recipe?.steps || ['']);
  const [saving, setSaving] = useState(false);

  const { upload, isUploading, uploadError, progress, clearError } = useImageUpload(uid);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearError();

    const url = await upload(file);
    if (url) setImageUrl(url);

    // Reset the input so the same file can be selected again
    if (e.target) e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      uid, title, description: desc, category,
      images: imageUrl ? [imageUrl] : [],
      ingredients: ingredients.filter(i => i.name),
      steps: steps.filter(s => s.trim()),
      createdAt: recipe?.createdAt || new Date().toISOString()
    };
    try {
      if (recipe?.id) {
        await updateDoc(doc(db, 'recipes', recipe.id), data);
      } else {
        await addDoc(collection(db, 'recipes'), data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save recipe:', err);
    } finally {
      setSaving(false);
    }
  };

  const removeIngredient = (idx: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">食譜名稱</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">分類</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm">
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            <option value="未分類">未分類</option>
          </select>
        </div>
      </div>

      {/* Photo upload - fixed version */}
      <div>
        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">食譜照片</label>
        <div className="flex gap-3 items-center">
          <label className={cn(
            "cursor-pointer bg-orange-50 text-orange-600 px-4 py-3 rounded-xl text-sm font-bold hover:bg-orange-100 transition-colors flex items-center gap-2",
            isUploading && "opacity-50 pointer-events-none"
          )}>
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            {isUploading ? `上傳中 ${progress}%` : '上傳照片'}
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          <div className="flex-1">
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="或輸入網址..." className="w-full p-3 bg-gray-50 rounded-xl border-none text-sm" />
          </div>
          {imageUrl && (
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 shrink-0 relative group">
              <img src={imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button type="button" onClick={() => setImageUrl('')}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <X size={14} className="text-white" />
              </button>
            </div>
          )}
        </div>
        {uploadError && (
          <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1">
            <AlertCircle size={10} /> {uploadError}
          </p>
        )}
      </div>

      <div>
        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">簡介</label>
        <div className="p-3 bg-gray-50 rounded-xl">
          <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-transparent border-none h-16 focus:ring-0 text-sm" />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">食材清單</label>
          <button type="button" onClick={() => setIngredients([...ingredients, { name: '', amount: '' }])} className="text-orange-600 text-xs font-bold">+ 新增</button>
        </div>
        {ingredients.map((ing, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-center">
            <input placeholder="食材" value={ing.name} onChange={e => {
              const newIngs = [...ingredients]; newIngs[idx] = { ...newIngs[idx], name: e.target.value }; setIngredients(newIngs);
            }} className="flex-1 p-2 bg-gray-50 rounded-xl border-none text-xs" />
            <input placeholder="份量" value={ing.amount} onChange={e => {
              const newIngs = [...ingredients]; newIngs[idx] = { ...newIngs[idx], amount: e.target.value }; setIngredients(newIngs);
            }} className="w-20 p-2 bg-gray-50 rounded-xl border-none text-xs" />
            {ingredients.length > 1 && (
              <button type="button" onClick={() => removeIngredient(idx)} className="text-gray-300 hover:text-red-400 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 block">步驟說明</label>
          <button type="button" onClick={() => setSteps([...steps, ''])} className="text-orange-600 text-xs font-bold">+ 新增</button>
        </div>
        {steps.map((step, idx) => (
          <div key={idx} className="flex gap-3 mb-2 items-start">
            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[8px] font-bold mt-2 shrink-0">{idx + 1}</span>
            <div className="flex-1 p-2 bg-gray-50 rounded-xl">
              <textarea value={step} onChange={e => {
                const newSteps = [...steps]; newSteps[idx] = e.target.value; setSteps(newSteps);
              }} className="w-full bg-transparent border-none text-xs h-12 focus:ring-0" />
            </div>
            {steps.length > 1 && (
              <button type="button" onClick={() => removeStep(idx)} className="text-gray-300 hover:text-red-400 shrink-0 mt-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onClose} className="flex-1 py-4 text-gray-500 text-sm font-medium">取消</button>
        <button type="submit" disabled={saving || isUploading}
          className="flex-1 py-4 bg-orange-600 text-white rounded-full text-sm font-medium shadow-lg disabled:opacity-50">
          {saving ? '儲存中...' : '儲存'}
        </button>
      </div>
    </form>
  );
}

/* ── Main Recipes Page ── */
export default function Recipes({ uid }: { uid: string }) {
  const { recipeCategories } = useSettingsContext();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Recipe | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const qR = query(collection(db, 'recipes'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
    const unsubR = onSnapshot(qR, (snapshot) => {
      setRecipes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)));
      setLoading(false);
    }, () => setLoading(false));

    const qI = query(collection(db, 'ingredients'), where('uid', '==', uid), where('isConsumed', '!=', true));
    const unsubI = onSnapshot(qI, (snapshot) => {
      setIngredients(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient)));
    });

    return () => { unsubR(); unsubI(); };
  }, [uid]);

  const deleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipes', id));
      setViewingRecipe(null);
    } catch (err) { console.error('Failed to delete recipe:', err); }
  };

  const generateAiRecipe = async () => {
    if (ingredients.length === 0) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const expiring = ingredients
        .sort((a, b) => {
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime();
        })
        .slice(0, 10)
        .map(i => i.name).join(', ');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `我現有的食材有：${expiring}。請根據這些食材推薦一個簡單的食譜。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "食譜名稱" },
              description: { type: Type.STRING, description: "食譜簡介" },
              ingredients: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.STRING } }, required: ["name", "amount"] } },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "description", "ingredients", "steps"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAiResult(result);
      setShowAiModal(true);
    } catch (error) {
      console.error('AI recipe generation failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiRecipe = async () => {
    if (!aiResult) return;
    try {
      await addDoc(collection(db, 'recipes'), {
        uid, ...aiResult, category: '未分類', createdAt: new Date().toISOString()
      });
      setShowAiModal(false);
      setAiResult(null);
    } catch (error) {
      console.error('Failed to save AI recipe:', error);
    }
  };

  const filteredRecipes = activeCategory ? recipes.filter(r => r.category === activeCategory) : recipes;

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="私房食譜" onAdd={() => setShowAdd(true)}
          extraAction={
            <button onClick={generateAiRecipe} disabled={aiLoading || ingredients.length === 0}
              className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-orange-200 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? '思考中...' : '剩菜組合'}
            </button>
          }
        />
        <FilterPills items={recipeCategories} active={activeCategory} onSelect={setActiveCategory} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <div className="px-1 grid grid-cols-3 gap-1.5">
          {filteredRecipes.map(recipe => (
            <button key={recipe.id} onClick={() => setViewingRecipe(recipe)}
              className="flex flex-col group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-50 p-1"
            >
              <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mb-1.5">
                {recipe.images?.[0] ? (
                  <img src={recipe.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300"><BookOpen size={14} /></div>
                )}
              </div>
              <h3 className="text-[12.5px] font-sans font-bold text-gray-900 text-center mb-0.5 px-0.5 leading-tight line-clamp-2">{recipe.title}</h3>
              {recipe.category && <span className="text-[8px] text-orange-400 font-bold uppercase tracking-widest text-center">{recipe.category}</span>}
            </button>
          ))}
        </div>
        {filteredRecipes.length === 0 && (
          <div className="text-center py-16 text-gray-300 text-sm">還沒有食譜，點右上角新增吧</div>
        )}
      </div>

      {/* AI Result Modal */}
      <AnimatePresence>
        {showAiModal && aiResult && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 max-h-[90vh] overflow-y-auto relative shadow-2xl"
            >
              <button onClick={() => setShowAiModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
              <div className="flex justify-between items-start mb-6 pr-8">
                <h2 className="text-2xl font-bold text-gray-900">AI 推薦食譜</h2>
                <button onClick={saveAiRecipe}
                  className="px-4 py-2 bg-orange-600 text-white rounded-full text-xs font-bold shadow-md hover:bg-orange-700 active:scale-95 flex items-center gap-2"
                >
                  <Plus size={14} />加入食譜
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{aiResult.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{aiResult.description}</p>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase font-bold text-orange-600 mb-3 tracking-widest">所需食材</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {aiResult.ingredients.map((ing, i) => (
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
                    {aiResult.steps.map((step, i) => (
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

      <AnimatePresence>
        {viewingRecipe && (
          <RecipeDetail recipe={viewingRecipe} onClose={() => setViewingRecipe(null)}
            onEdit={(r) => { setEditingRecipe(r); setViewingRecipe(null); }}
            onDelete={deleteRecipe}
          />
        )}
      </AnimatePresence>

      {(showAdd || editingRecipe) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[32px] p-8 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold mb-6">{editingRecipe ? '編輯食譜' : '新增食譜'}</h2>
            <RecipeForm uid={uid} recipe={editingRecipe || undefined} categories={recipeCategories}
              onClose={() => { setShowAdd(false); setEditingRecipe(null); }}
            />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
