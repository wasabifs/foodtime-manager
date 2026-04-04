import type { LucideIcon } from 'lucide-react';

export interface Ingredient {
  id?: string;
  uid: string;
  name: string;
  purchaseDate?: string;
  expiryDate: string;
  amount: number;
  unit: string;
  price?: number;
  storage?: string;
  category?: string;
  storageLocation?: string;
  purchaseLocation?: string;
  isConsumed?: boolean;
  createdAt: string;
}

export interface Recipe {
  id?: string;
  uid: string;
  title: string;
  description?: string;
  category?: string;
  images?: string[];
  ingredients: { name: string; amount: string }[];
  steps: string[];
  createdAt: string;
}

export interface ShoppingItem {
  id?: string;
  uid: string;
  name: string;
  category?: string;
  location?: string;
  checked: boolean;
  createdAt: string;
  note?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealItem {
  recipeId?: string;
  name?: string;
}

export interface MealPlan {
  id?: string;
  uid: string;
  date: string;
  breakfast?: MealItem[];
  lunch?: MealItem[];
  dinner?: MealItem[];
  snack?: MealItem[];
  createdAt: string;
}

export interface UserSettings {
  id?: string;
  uid: string;
  storageLocations: string[];
  purchaseLocations: string[];
  recipeCategories: string[];
  ingredientCategories: string[];
}

export type LocationType = 'storage' | 'purchase' | 'recipe' | 'ingredient';

export type TabType = 'shopping' | 'inventory' | 'recipes' | 'planner' | 'settings';

export interface InventoryAction {
  type: 'add';
  name: string;
  location?: string;
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '點心',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  storage: '儲存地點管理',
  purchase: '採購地點管理',
  recipe: '食譜分類管理',
  ingredient: '食材分類管理',
};

export const LOCATION_TYPE_FIELDS: Record<LocationType, keyof UserSettings> = {
  storage: 'storageLocations',
  purchase: 'purchaseLocations',
  recipe: 'recipeCategories',
  ingredient: 'ingredientCategories',
};

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'uid'> = {
  storageLocations: ['冷藏', '冷凍', '常溫'],
  purchaseLocations: ['全聯', '家樂福', '傳統市場'],
  recipeCategories: ['主食', '甜點', '湯品'],
  ingredientCategories: ['蔬菜', '肉類', '海鮮', '水果', '乳製品', '調味料'],
};
