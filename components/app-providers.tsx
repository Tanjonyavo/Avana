"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, Product } from "@/types";
import type { CatalogSnapshot } from "@/types/commerce";
import { cartStorageSchema, favoritesStorageSchema } from "@/lib/client-storage-schemas";
import { addCartItem, setCartItemQuantity } from "@/lib/commerce";
import { readStorage, writeStorage } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics-client";

const CartDrawer = dynamic(() => import("@/components/cart-drawer").then((module) => module.CartDrawer), {
  ssr: false,
});
const SearchModal = dynamic(() => import("@/components/search-modal").then((module) => module.SearchModal), {
  ssr: false,
});
type Toast = { id: number; message: string };

interface AppContextValue {
  cart: CartItem[];
  cartCount: number;
  favorites: string[];
  catalog: Product[];
  catalogMode: CatalogSnapshot["mode"];
  isCartOpen: boolean;
  isSearchOpen: boolean;
  addToCart: (productId: string, variantId: string, quantity?: number) => void;
  updateQuantity: (productId: string, variantId: string, quantity: number) => void;
  removeFromCart: (productId: string, variantId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  setCartOpen: (value: boolean) => void;
  setSearchOpen: (value: boolean) => void;
  notify: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({
  children,
  catalog,
  catalogMode,
}: {
  children: React.ReactNode;
  catalog: Product[];
  catalogMode: CatalogSnapshot["mode"];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isCartOpen, setCartOpenState] = useState(false);
  const [isSearchOpen, setSearchOpenState] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedCart = readStorage(localStorage, "avana-cart", cartStorageSchema, []);
      const storedFavorites = readStorage(localStorage, "avana-favorites", favoritesStorageSchema, []);
      setCart((current) =>
        current.reduce(
          (merged, item) => addCartItem(merged, item.productId, item.variantId, item.quantity),
          storedCart,
        ),
      );
      setFavorites((current) => [...new Set([...storedFavorites, ...current])]);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(localStorage, "avana-cart", cart);
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) writeStorage(localStorage, "avana-favorites", favorites);
  }, [favorites, hydrated]);

  const notify = useCallback((message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const setCartOpen = useCallback((value: boolean) => {
    setCartOpenState(value);
    if (value) setSearchOpenState(false);
  }, []);

  const setSearchOpen = useCallback((value: boolean) => {
    setSearchOpenState(value);
    if (value) setCartOpenState(false);
  }, []);

  const addToCart = useCallback(
    (productId: string, variantId: string, quantity = 1) => {
      setCart((current) => addCartItem(current, productId, variantId, quantity));
      trackEvent("add_to_cart", { productId, variantId, quantity });
      notify("Produit ajouté au panier");
      setCartOpen(true);
    },
    [notify, setCartOpen],
  );

  const updateQuantity = useCallback((productId: string, variantId: string, quantity: number) => {
    setCart((current) => setCartItemQuantity(current, productId, variantId, quantity));
  }, []);

  const removeFromCart = useCallback(
    (productId: string, variantId: string) => {
      setCart((current) =>
        current.filter((item) => !(item.productId === productId && item.variantId === variantId)),
      );
      notify("Produit retiré du panier");
    },
    [notify],
  );

  const clearCart = useCallback(() => setCart([]), []);
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((current) =>
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setSearchOpen]);

  const value = useMemo(
    () => ({
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      favorites,
      catalog,
      catalogMode,
      isCartOpen,
      isSearchOpen,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      toggleFavorite,
      setCartOpen,
      setSearchOpen,
      notify,
    }),
    [
      catalog,
      catalogMode,
      cart,
      favorites,
      isCartOpen,
      isSearchOpen,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      toggleFavorite,
      setCartOpen,
      setSearchOpen,
      notify,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {isCartOpen && <CartDrawer />}
      {isSearchOpen && <SearchModal />}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            ✓ {toast.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProviders");
  return context;
}
