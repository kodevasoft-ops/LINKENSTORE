'use client';
import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?:  string;
  role: 'customer' | 'advisor' | 'technician' | 'admin' | 'superadmin';
}

export interface CartItem {
  id:     string;
  name:   string;
  price:  number;
  image?: string;
  qty:    number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  setToken:     (access: string, refresh: string, user: AuthUser) => void;
  clear:        () => void;
  hydrate:      () => void;
}

const AUTH_KEY = 'katalog_auth';

export const useAuthStore = create<AuthState>((set) => ({
  user: null, accessToken: null, refreshToken: null,

  setToken: (access, refresh, user) => {
    set({ accessToken: access, refreshToken: refresh, user });
    if (typeof window !== 'undefined')
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({ access, refresh, user }));
  },

  clear: () => {
    set({ user: null, accessToken: null, refreshToken: null });
    if (typeof window !== 'undefined') sessionStorage.removeItem(AUTH_KEY);
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return;
      const { access, refresh, user } = JSON.parse(raw);
      set({ accessToken: access, refreshToken: refresh, user });
    } catch { sessionStorage.removeItem(AUTH_KEY); }
  },
}));

// ── Cart ──────────────────────────────────────────────────────────────────────
interface CartState {
  items:      CartItem[];
  total:      number;
  itemCount:  number;
  addItem:    (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQty:  (id: string, qty: number) => void;
  clearCart:  () => void;
  hydrate:    () => void;
}

const CART_KEY = 'katalog_cart';

function totals(items: CartItem[]) {
  return {
    total:     items.reduce((s, i) => s + i.price * i.qty, 0),
    itemCount: items.reduce((s, i) => s + i.qty, 0),
  };
}

function persist(items: CartItem[]) {
  if (typeof window !== 'undefined') sessionStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [], total: 0, itemCount: 0,

  addItem: (item) => {
    const items = [...get().items];
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + item.qty };
    else items.push(item);
    set({ items, ...totals(items) });
    persist(items);
  },

  removeItem: (id) => {
    const items = get().items.filter(i => i.id !== id);
    set({ items, ...totals(items) });
    persist(items);
  },

  updateQty: (id, qty) => {
    const items = get().items.map(i => i.id === id ? { ...i, qty } : i).filter(i => i.qty > 0);
    set({ items, ...totals(items) });
    persist(items);
  },

  clearCart: () => { set({ items: [], total: 0, itemCount: 0 }); persist([]); },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      if (!raw) return;
      const items: CartItem[] = JSON.parse(raw);
      set({ items, ...totals(items) });
    } catch { sessionStorage.removeItem(CART_KEY); }
  },
}));

// ── UI ────────────────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean;
  cartOpen:    boolean;
  searchOpen:  boolean;
  toggleSidebar:  () => void;
  setCartOpen:    (v: boolean) => void;
  setSearchOpen:  (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  cartOpen:    false,
  searchOpen:  false,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setCartOpen:   (v) => set({ cartOpen: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
}));
