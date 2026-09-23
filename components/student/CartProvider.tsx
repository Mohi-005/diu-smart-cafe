"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  cafe_id: string;
  cafe_name: string;
  quantity: number;
};

type AddToCartResult = {
  success: boolean;
  message?: string;
};

type CartContextType = {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  cafeId: string | null;
  cafeName: string | null;
  addToCart: (item: CartItem) => AddToCartResult;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(
  undefined
);

const CART_STORAGE_KEY = "diu-smart-cafe-cart";
const MAX_QUANTITY = 20;

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);

      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {
          const safeCart = parsedCart
            .filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                typeof item.price === "number" &&
                typeof item.cafe_id === "string" &&
                typeof item.cafe_name === "string"
            )
            .map((item) => ({
              ...item,
              price: Math.max(0, Number(item.price)),
              quantity: Math.min(
                MAX_QUANTITY,
                Math.max(1, Number(item.quantity) || 1)
              ),
            }));

          setItems(safeCart);
        }
      }
    } catch {
      localStorage.removeItem(CART_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(items)
    );
  }, [items, isHydrated]);

  function addToCart(item: CartItem): AddToCartResult {
    /*
     * One cart = one cafe.
     *
     * A customer can order from another cafe after
     * completing/clearing the current cart.
     */
    if (
      items.length > 0 &&
      items[0].cafe_id !== item.cafe_id
    ) {
      return {
        success: false,
        message:
          `Your cart already contains food from ${items[0].cafe_name}. ` +
          `Please complete or clear that cart before ordering from ${item.cafe_name}.`,
      };
    }

    const requestedQuantity = Math.min(
      MAX_QUANTITY,
      Math.max(1, Number(item.quantity) || 1)
    );

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (cartItem) => cartItem.id === item.id
      );

      if (existingItem) {
        return currentItems.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: Math.min(
                  MAX_QUANTITY,
                  cartItem.quantity + requestedQuantity
                ),
              }
            : cartItem
        );
      }

      return [
        ...currentItems,
        {
          ...item,
          quantity: requestedQuantity,
        },
      ];
    });

    return {
      success: true,
      message: `${requestedQuantity} item${
        requestedQuantity > 1 ? "s" : ""
      } added to cart.`,
    };
  }

  function increaseQuantity(id: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.min(
                MAX_QUANTITY,
                item.quantity + 1
              ),
            }
          : item
      )
    );
  }

  function decreaseQuantity(id: string) {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  }

  function clearCart() {
    setItems([]);
  }

  const itemCount = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.quantity,
        0
      ),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      ),
    [items]
  );

  const cafeId = items[0]?.cafe_id ?? null;
  const cafeName = items[0]?.cafe_name ?? null;

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalAmount,
        cafeId,
        cafeName,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider."
    );
  }

  return context;
}