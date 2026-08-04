import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Plus, Sparkles, X, Camera, AlertCircle, Loader2, Search, Tag, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettingsContext } from '../contexts/SettingsContext';
import { useImageUpload } from '../hooks/useImageUpload';
import { SectionHeader, FilterPills, ConfirmModal, LoadingSkeleton } from '../components/ui';
import type { Ingredient, Recipe } from '../types';
import { parseISO } from 'date-fns';

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
        {recipe.description && <p className="text-sm text-gray-500 mb-4 leading-relaxed">{recipe.description}</p>}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {recipe.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold border border-orange-100">
                <Tag size={9} />{tag}
              </span>
            ))}
          </div>
        )}

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

/* ── Image Crop Modal (4:3, drag to pan, slider to zoom) ── */
function ImageCropModal({ file, onCancel, onCropped }: {
  file: File; onCancel: () => void; onCropped: (cropped: File) => void;
}) {
  const [url] = useState(() => URL.createObjectURL(file));
  const containerRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const getScale = (z: number) => {
    const el = containerRef.current;
    if (!el || !natural.w) return 1;
    return Math.max(el.clientWidth / natural.w, el.clientHeight / natural.h) * z;
  };

  const clampPos = (p: { x: number; y: number }, z: number) => {
    const el = containerRef.current;
    if (!el || !natural.w) return p;
    const scale = getScale(z);
    const maxX = Math.max(0, (natural.w * scale - el.clientWidth) / 2);
    const maxY = Math.max(0, (natural.h * scale - el.clientHeight) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos(clampPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }, zoom));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleZoom = (z: number) => {
    setZoom(z);
    setPos(p => clampPos(p, z));
  };

  const confirmCrop = () => {
    const el = containerRef.current;
    const img = imgElRef.current;
    if (!el || !img || !natural.w) return;
    setProcessing(true);
    const scale = getScale(zoom);
    const srcW = el.clientWidth / scale;
    const srcH = el.clientHeight / scale;
    const srcX = natural.w / 2 - pos.x / scale - srcW / 2;
    const srcY = natural.h / 2 - pos.y / scale - srcH / 2;

    const canvas = document.createElement('canvas');
    const outW = Math.min(1200, Math.round(srcW));
    canvas.width = outW;
    canvas.height = Math.round(outW * 3 / 4);
    const ctx = canvas.getContext('2d');
    if (!ctx) { setProcessing(false); return; }
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      setProcessing(false);
      if (!blob) return;
      const name = file.name.replace(/\.[^.]+$/, '') + '_cropped.jpg';
      onCropped(new File([blob], name, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  };

  const scale = getScale(zoom);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-1">剪裁照片</h2>
        <p className="text-xs text-gray-400 mb-4">拖曳調整位置，滑桿調整縮放</p>

        <div ref={containerRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          className="relative w-full aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden touch-none cursor-move select-none"
        >
          {natural.w > 0 && (
            <img ref={imgElRef} src={url} draggable={false}
              onLoad={() => {}}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                width: natural.w * scale,
                height: natural.h * scale,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              }}
            />
          )}
          {/* hidden loader to read natural size */}
          {natural.w === 0 && (
            <img src={url} className="absolute inset-0 w-full h-full object-contain opacity-0"
              onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          )}
          <div className="absolute inset-0 border-2 border-white/40 rounded-2xl pointer-events-none" />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] font-bold text-gray-400 shrink-0">縮放</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => handleZoom(Number(e.target.value))}
            className="flex-1 accent-orange-600" />
        </div>

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onCancel} className="flex-1 py-3 text-gray-500 text-sm font-medium">取消</button>
          <button type="button" onClick={confirmCrop} disabled={processing || !natural.w}
            className="flex-1 py-3 bg-orange-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            {processing ? '處理中...' : '完成剪裁'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Recipe Form with fixed upload ── */
function RecipeForm({ uid, recipe, categories, allTags, onClose }: {
  uid: string; recipe?: Recipe; categories: string[]; allTags: string[]; onClose: () => void;
}) {
  const [title, setTitle] = useState(recipe?.title || '');
  const [desc, setDesc] = useState(recipe?.description || '');
  const [category, setCategory] = useState(recipe?.category || categories[0] || '');
  const [imageUrl, setImageUrl] = useState(recipe?.images?.[0] || '');
  const [tags, setTags] = useState<string[]>(recipe?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [ingredients, setIngredients] = useState(recipe?.ingredients || [{ name: '', amount: '' }]);
  const [steps, setSteps] = useState(recipe?.steps || ['']);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const { upload, isUploading, uploadError, progress, clearError } = useImageUpload(uid);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearError();
    setCropFile(file);
    // Reset the input so the same file can be selected again
    if (e.target) e.target.value = '';
  };

  const handleCropped = async (cropped: File) => {
    setCropFile(null);
    const url = await upload(cropped);
    if (url) setImageUrl(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = {
      uid, title, description: desc, category, tags,
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

  const addTag = () => {
    const t = tagInput.trim().replace(/[,，]/g, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      addTag();
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
        <div className="col-span-2">
          <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">標籤</label>
          <div className="flex gap-2">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} onBlur={addTag}
              placeholder="輸入標籤後按 Enter 或逗號..." className="flex-1 p-3 bg-gray-50 rounded-xl border-none text-sm focus:ring-1 focus:ring-orange-500" />
            <button type="button" onClick={addTag} className="px-4 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold shrink-0">加入</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold border border-orange-100">
                  <Tag size={9} />{tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="text-orange-400 hover:text-orange-700"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          {allTags.filter(t => !tags.includes(t)).length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] text-gray-300 font-bold mb-1">現有標籤（點擊加入）</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.filter(t => !tags.includes(t)).map(tag => (
                  <button key={tag} type="button" onClick={() => setTags([...tags, tag])}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold border border-gray-200 active:bg-orange-50 active:text-orange-600 active:border-orange-100 transition-colors"
                  >
                    <Plus size={9} />{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
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
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
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

      <AnimatePresence>
        {cropFile && (
          <ImageCropModal file={cropFile} onCancel={() => setCropFile(null)} onCropped={handleCropped} />
        )}
      </AnimatePresence>
    </form>
  );
}

// 只要這次 App 開啟期間成功讀取過一次，切分頁回來就不再顯示 loading skeleton
let hasLoadedRecipesOnce = false;

/* ── Main Recipes Page ── */
export default function Recipes({ uid }: { uid: string }) {
  const { recipeCategories } = useSettingsContext();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(!hasLoadedRecipesOnce);
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<Recipe | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const qR = query(collection(db, 'recipes'), where('uid', '==', uid));
    const unsubR = onSnapshot(qR, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setRecipes(all);
      hasLoadedRecipesOnce = true;
      setLoading(false);
    }, () => setLoading(false));

    const qI = query(collection(db, 'ingredients'), where('uid', '==', uid));
    const unsubI = onSnapshot(qI, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient));
      setIngredients(all.filter(ing => !ing.isConsumed));
    });

    return () => { unsubR(); unsubI(); };
  }, [uid]);

  const deleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipes', id));
      setViewingRecipe(null);
    } catch (err) { console.error('Failed to delete recipe:', err); }
  };

  // Sorted expiry-first list for the picker (no expiry goes last)
  const sortedByExpiry = [...ingredients].sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime();
  });

  const openPicker = () => {
    setSelectedIds(new Set());
    setShowPicker(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generateAiRecipe = async () => {
    const selected = sortedByExpiry.filter(i => i.id && selectedIds.has(i.id));
    if (selected.length === 0) return;
    setShowPicker(false);
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: selected.map(i => ({ name: i.name, amount: i.amount, unit: i.unit })),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.recipe) {
        throw new Error(data?.error || `伺服器回應錯誤（${res.status}）`);
      }

      setAiResult(data.recipe);
      setShowAiModal(true);
    } catch (error) {
      console.error('AI recipe generation failed:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setAiError(`生成失敗：${msg}`);
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

  const allTags = Array.from(new Set(recipes.flatMap(r => r.tags || []))).sort();

  const keyword = searchTerm.trim().toLowerCase();
  const filteredRecipes = recipes.filter(r => {
    if (activeCategory && r.category !== activeCategory) return false;
    if (selectedTag && !(r.tags || []).includes(selectedTag)) return false;
    if (!keyword) return true;
    return (
      r.title.toLowerCase().includes(keyword) ||
      (r.description || '').toLowerCase().includes(keyword) ||
      (r.tags || []).some(t => t.toLowerCase().includes(keyword)) ||
      r.ingredients.some(i => i.name.toLowerCase().includes(keyword))
    );
  });

  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="私房食譜" onAdd={() => setShowAdd(true)}
          extraAction={
            <button onClick={openPicker} disabled={aiLoading || ingredients.length === 0}
              className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-sm hover:bg-orange-200 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? '思考中...' : '剩菜組合'}
            </button>
          }
        />
        <div className="mt-2 flex gap-2">
          <div className="relative w-1/2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜尋..."
              className="w-full py-2 pl-9 pr-7 bg-white rounded-2xl shadow-sm border border-gray-100 text-xs outline-none focus:ring-1 focus:ring-orange-500 [&::-webkit-search-cancel-button]:hidden" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>
            )}
          </div>
          <div className="relative flex-1">
            <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
            <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)}
              className={cn(
                "w-full h-full py-2 pl-8 pr-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-xs outline-none appearance-none focus:ring-1 focus:ring-orange-500",
                selectedTag ? "text-orange-600 font-bold" : "text-gray-400"
              )}
            >
              <option value="">全部標籤</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        </div>
        <FilterPills items={recipeCategories} active={activeCategory} onSelect={setActiveCategory} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
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
          <div className="text-center py-16 text-gray-300 text-sm">
            {keyword || activeCategory || selectedTag ? '找不到符合的食譜' : '還沒有食譜，點右上角新增吧'}
          </div>
        )}
      </div>

      {/* Ingredient Picker for AI */}
      <AnimatePresence>
        {showPicker && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 pb-4 shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">選擇要使用的食材</h2>
                    <p className="text-xs text-gray-400 mt-1">依到期日排序，快過期的在前面</p>
                  </div>
                  <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 space-y-1.5">
                {sortedByExpiry.map(ing => {
                  const checked = !!ing.id && selectedIds.has(ing.id);
                  return (
                    <button key={ing.id} type="button" onClick={() => ing.id && toggleSelected(ing.id)}
                      className={cn(
                        "w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-colors text-left",
                        checked ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      {checked ? <CheckCircle2 className="text-orange-600 shrink-0" size={18} /> : <Circle className="text-gray-300 shrink-0" size={18} />}
                      <span className="text-sm font-bold text-gray-700 truncate flex-1">{ing.name}</span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">{ing.amount}{ing.unit}</span>
                      {ing.expiryDate && (
                        <span className="text-[9px] font-mono bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                          {ing.expiryDate.split('-').slice(1).join('/')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="p-5 border-t border-gray-100 shrink-0">
                <button onClick={generateAiRecipe} disabled={selectedIds.size === 0}
                  className="w-full py-3.5 bg-orange-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  {selectedIds.size === 0 ? '請先勾選食材' : `用這 ${selectedIds.size} 樣食材生成菜色`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Loading Overlay */}
      <AnimatePresence>
        {aiLoading && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] px-10 py-8 shadow-2xl flex flex-col items-center gap-3"
            >
              <Loader2 size={32} className="animate-spin text-orange-600" />
              <p className="text-sm font-bold text-gray-700">AI 正在思考菜色...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Error Modal */}
      <AnimatePresence>
        {aiError && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">無法生成菜色</h3>
              <p className="text-xs text-gray-500 leading-relaxed break-all">{aiError}</p>
              <button onClick={() => setAiError(null)}
                className="w-full mt-5 py-3 bg-orange-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform"
              >知道了</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            <RecipeForm uid={uid} recipe={editingRecipe || undefined} categories={recipeCategories} allTags={allTags}
              onClose={() => { setShowAdd(false); setEditingRecipe(null); }}
            />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
