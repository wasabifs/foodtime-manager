import { useState } from 'react';
import { WifiOff, Download, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ── Offline Banner ── */
export function OfflineBanner({ isOnline }: { isOnline: boolean }) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-white overflow-hidden z-50 shrink-0"
        >
          <div className="flex items-center justify-center gap-2 py-1.5 px-4">
            <WifiOff size={12} />
            <span className="text-[11px] font-bold">目前離線中 — 資料會在恢復連線後自動同步</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Install Prompt Banner ── */
export function InstallPrompt({ onInstall, onDismiss }: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-28 left-4 right-4 max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-orange-100 p-4 z-30 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
        <Download size={20} className="text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">安裝食刻管理</p>
        <p className="text-[11px] text-gray-500">加到主畫面，隨時快速開啟</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onDismiss}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={16} />
        </button>
        <button onClick={onInstall}
          className="px-4 py-2 bg-orange-600 text-white rounded-full text-xs font-bold shadow-sm active:scale-95 transition-transform"
        >
          安裝
        </button>
      </div>
    </motion.div>
  );
}

/* ── Update Available Banner ── */
export function UpdateBanner({ onReload }: { onReload: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-blue-600 text-white z-50 rounded-b-2xl shadow-lg"
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} />
          <span className="text-xs font-bold">有新版本可用</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDismissed(true)}
            className="text-[11px] text-blue-200 font-medium px-2 py-1"
          >
            稍後
          </button>
          <button onClick={onReload}
            className="text-[11px] bg-white text-blue-600 font-bold px-3 py-1 rounded-full active:scale-95 transition-transform"
          >
            立即更新
          </button>
        </div>
      </div>
    </motion.div>
  );
}
