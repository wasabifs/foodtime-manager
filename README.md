# 食刻管理 FoodTime Manager v2

全方位的食材管理、採購清單、私房食譜與菜色安排 PWA。

## v2 改進項目

### 架構重構
- App.tsx 從 2,423 行拆分為 12 個獨立模組
- 移除所有未使用的重複檔案（原 src/Inventory.tsx、Recipes.tsx 等）
- 建立共享 hooks（useSettings、useCollection、useImageUpload）
- 使用 React Context（SettingsProvider）統一管理設定訂閱，避免重複訂閱

### Bug 修復
- 修復食譜照片上傳失敗問題：新增 base64 壓縮備援方案
- 修復購物清單勾選流程：先詢問再刪除，避免資料遺失
- 移除所有 debug 用 console.log

### TypeScript 改善
- 新增 MealType、MealItem、LocationType 等正確型別
- 移除所有 `as any` 型別斷言
- icon props 改用 LucideIcon 型別

### UX 改善
- 所有頁面新增 loading skeleton
- deleteRecipe 改用自訂 ConfirmModal（取代原生 confirm/alert）
- 新增 Toast 通知元件
- 食譜表單新增上傳進度指示
- 食譜表單新增移除食材/步驟按鈕
- 空狀態提示文字

### 錯誤處理
- 所有 Firebase 操作加上 try-catch
- Firestore onSnapshot 加上 error callback
- 圖片上傳新增 Firebase Storage 失敗時的 base64 備援

## 專案結構

```
src/
├── App.tsx                  # 主要路由與佈局（~130 行）
├── main.tsx
├── index.css
├── firebase.ts
├── types.ts                 # 完整型別定義
├── contexts/
│   └── SettingsContext.tsx   # 設定共享 Context
├── hooks/
│   ├── useSettings.ts       # 設定訂閱 hook
│   ├── useCollection.ts     # 通用 Firestore 訂閱 hook
│   └── useImageUpload.ts    # 圖片上傳 hook（含 base64 備援）
├── components/
│   └── ui.tsx               # 共享 UI 元件
├── pages/
│   ├── ShoppingList.tsx     # 採購清單
│   ├── Inventory.tsx        # 食材管理
│   ├── Recipes.tsx          # 食譜管理
│   ├── MealPlanner.tsx      # 每日菜單
│   └── Settings.tsx         # 設定
└── lib/
    └── utils.ts
```

## 開發

```bash
npm install
npm run dev
```
