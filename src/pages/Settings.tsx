import { useState } from 'react';
import { Store, Tag, MapPin, BookOpen, LogOut, ChevronRight, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { logOut } from '../firebase';
import { useSettingsContext } from '../contexts/SettingsContext';
import { SectionHeader, LocationManager } from '../components/ui';
import type { LocationType } from '../types';
import type { LucideIcon } from 'lucide-react';

function SettingItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><Icon size={20} /></div>
        <span className="text-sm font-bold text-gray-700">{label}</span>
      </div>
      <ChevronRight size={18} className="text-gray-300" />
    </button>
  );
}

export default function Settings({ uid }: { uid: string }) {
  const { purchaseLocations, ingredientCategories, storageLocations, recipeCategories } = useSettingsContext();
  const [manageType, setManageType] = useState<LocationType | null>(null);

  const getLocations = (type: LocationType) => {
    switch (type) {
      case 'purchase': return purchaseLocations;
      case 'ingredient': return ingredientCategories;
      case 'storage': return storageLocations;
      case 'recipe': return recipeCategories;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden"
    >
      <div className="bg-gray-50 px-4 pt-2 pb-2 border-b border-gray-100 shrink-0 z-20">
        <SectionHeader title="設定" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-32">
        <div className="space-y-3">
          <SettingItem icon={Store} label="採購地點管理" onClick={() => setManageType('purchase')} />
          <SettingItem icon={Tag} label="食材分類管理" onClick={() => setManageType('ingredient')} />
          <SettingItem icon={MapPin} label="儲存地點管理" onClick={() => setManageType('storage')} />
          <SettingItem icon={BookOpen} label="食譜分類管理" onClick={() => setManageType('recipe')} />
          <SettingItem icon={HelpCircle} label="使用說明" onClick={() => window.open('/usage-guide.html', '_blank')} />
        </div>

        <div className="pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-2 mb-3">帳號</h3>
          <button onClick={logOut}
            className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
          >
            <LogOut size={18} />登出帳號
          </button>
        </div>
      </div>

      {manageType && (
        <LocationManager type={manageType} locations={getLocations(manageType)} onClose={() => setManageType(null)} />
      )}
    </motion.div>
  );
}
