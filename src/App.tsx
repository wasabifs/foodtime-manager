import { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signIn, db } from './firebase';
import { collection, query, where, onSnapshot, doc, getDocFromServer } from 'firebase/firestore';
import { ShoppingBag, Carrot, CookingPot, CalendarDays, Edit2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseISO } from 'date-fns';
import { SettingsProvider } from './contexts/SettingsContext';
import { TabButton, AppLogo } from './components/ui';
import { OfflineBanner, InstallPrompt, UpdateBanner } from './components/PWAComponents';
import { usePWA } from './hooks/usePWA';
import ShoppingList from './pages/ShoppingList';
import Inventory from './pages/Inventory';
import Recipes from './pages/Recipes';
import MealPlanner from './pages/MealPlanner';
import Settings from './pages/Settings';
import type { Ingredient, TabType, InventoryAction } from './types';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [expiringSoon, setExpiringSoon] = useState<Ingredient[]>([]);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const hasShownExpiryModal = useRef(false);
  const [inventoryAction, setInventoryAction] = useState<InventoryAction | null>(null);

  // PWA features
  const { isOnline, canInstall, installApp, updateAvailable, reloadForUpdate } = usePWA();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const installDismissed = useRef(false);

  // Show install prompt after 30 seconds if available
  useEffect(() => {
    if (canInstall && !installDismissed.current && user) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 30000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, user]);

  useEffect(() => {
    if (!loading && user) {
      getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});

      const q = query(collection(db, 'ingredients'), where('uid', '==', user.uid), where('isConsumed', '!=', true));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ingredient));
        const soon = ings.filter(ing => {
          if (!ing.expiryDate) return false;
          const expiry = parseISO(ing.expiryDate);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          return diff >= 0 && diff <= 3;
        });
        if (soon.length > 0 && !hasShownExpiryModal.current) {
          setExpiringSoon(soon);
          setShowExpiryModal(true);
          hasShownExpiryModal.current = true;
        }
      });
      return () => unsubscribe();
    }
  }, [user, loading]);

  if (loading) return (
    <div className="min-h-screen bg-[#f5f2ed] flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <AppLogo size={60} />
        <div className="animate-pulse text-orange-600 font-bold text-lg">載入中...</div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#f5f2ed] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-xl text-center border border-orange-100 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-50 rounded-full blur-3xl opacity-50" />
        <div className="mb-8 flex justify-center"><AppLogo size={100} /></div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">食刻管理</h1>
        <p className="text-gray-400 mb-8 font-light tracking-widest text-xs uppercase">FoodTime Manager</p>
        <div className="space-y-4 mb-10">
          <p className="text-sm text-gray-600 leading-relaxed">輕鬆管理食材庫存、規劃每日菜色，<br />讓廚房生活更有條理。</p>
          <div className="flex justify-center gap-2">
            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-bold">食材追蹤</span>
            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-bold">採購清單</span>
            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-bold">每週菜單</span>
          </div>
        </div>
        <button onClick={signIn}
          className="w-full py-4 bg-orange-600 text-white rounded-full font-bold shadow-lg hover:bg-orange-700 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
        >
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
          </div>
          使用 Google 帳號登入
        </button>

        {!isOnline && (
          <p className="mt-4 text-xs text-amber-600 font-medium">目前離線，登入需要網路連線</p>
        )}
      </div>
    </div>
  );

  return (
    <SettingsProvider uid={user.uid}>
      <div className="fixed inset-0 h-[100dvh] bg-[#f2f2f7] max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col font-sans overscroll-none">

        {/* Update notification */}
        {updateAvailable && <UpdateBanner onReload={reloadForUpdate} />}

        {/* Offline indicator */}
        <OfflineBanner isOnline={isOnline} />

        <main className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'shopping' && <ShoppingList key="shopping" uid={user.uid} setInventoryAction={setInventoryAction} setActiveTab={setActiveTab} />}
            {activeTab === 'inventory' && <Inventory key="inventory" uid={user.uid} inventoryAction={inventoryAction} setInventoryAction={setInventoryAction} />}
            {activeTab === 'recipes' && <Recipes key="recipes" uid={user.uid} />}
            {activeTab === 'planner' && <MealPlanner key="planner" uid={user.uid} />}
            {activeTab === 'settings' && <Settings key="settings" uid={user.uid} />}
          </AnimatePresence>
        </main>

        {/* Expiry Alert Modal */}
        <AnimatePresence>
          {showExpiryModal && expiringSoon.length > 0 && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-orange-100"
              >
                <div className="p-6 text-center bg-orange-50/50">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="text-orange-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">即將到期提醒</h3>
                  <p className="text-xs text-gray-500 mt-1">以下食材建議在三日內食用完畢</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-4 space-y-1.5">
                  {[...expiringSoon].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map(ing => (
                    <div key={ing.id} className="flex justify-between items-center py-1.5 px-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-700 truncate">{ing.name}</span>
                        <span className="text-[9px] font-bold text-orange-600 bg-orange-100/50 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                          {ing.storageLocation || '未分類'}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono bg-orange-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                        {ing.expiryDate.split('-').slice(1).join('/')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button onClick={() => setShowExpiryModal(false)}
                    className="w-full py-3 bg-orange-600 text-white rounded-full text-sm font-bold shadow-lg active:scale-95 transition-transform"
                  >知道了</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* PWA Install Prompt */}
        <AnimatePresence>
          {showInstallPrompt && canInstall && (
            <InstallPrompt
              onInstall={async () => {
                await installApp();
                setShowInstallPrompt(false);
              }}
              onDismiss={() => {
                setShowInstallPrompt(false);
                installDismissed.current = true;
              }}
            />
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="fixed bottom-10 left-4 right-4 max-w-md mx-auto bg-white/90 backdrop-blur-xl border border-gray-100 flex justify-around z-20 pb-2 pt-2 rounded-3xl shadow-2xl">
          <TabButton active={activeTab === 'shopping'} onClick={() => setActiveTab('shopping')} icon={ShoppingBag} label="採購" />
          <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={Carrot} label="食材" />
          <TabButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')} icon={CookingPot} label="食譜" />
          <TabButton active={activeTab === 'planner'} onClick={() => setActiveTab('planner')} icon={CalendarDays} label="菜單" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Edit2} label="設定" />
        </nav>
      </div>
    </SettingsProvider>
  );
}
