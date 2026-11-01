"use client";
import Link from "next/link";
import { ThemeMenu } from "@/components/theme-menu";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { productCover } from "@/lib/demo/albums";
import { findDemoProduct, money } from "@/lib/demo/catalog";
import {
  addToCart,
  cartTotal,
  DEMO_STORAGE,
  persistedDemoSchema,
  type CartLine,
} from "@/lib/demo/state";

type Saved = import("@/lib/demo/state").PersistedDemo;
const empty: Saved = { version: 1, cart: [], layouts: null, collections: {} },
  eventName = "rescene-demo-store";
let memory: string | null = null,
  storageUnavailable = false;
function read() {
  if (storageUnavailable) return memory;
  try {
    return localStorage.getItem(DEMO_STORAGE);
  } catch {
    storageUnavailable = true;
    return memory;
  }
}
function saved(): Saved {
  try {
    return persistedDemoSchema.parse(JSON.parse(read() ?? "null"));
  } catch {
    return empty;
  }
}
function write(value: Saved) {
  memory = JSON.stringify(value);
  try {
    localStorage.setItem(DEMO_STORAGE, memory);
  } catch {
    storageUnavailable = true;
  }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(cb: () => void) {
  window.addEventListener(eventName, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(eventName, cb);
    window.removeEventListener("storage", cb);
  };
}
type Store = {
  hydrated: boolean;
  cart: CartLine[];
  layouts: Saved["layouts"];
  collections: Saved["collections"];
  setCollection: (
    id: string,
    value: import("@/lib/demo/state").LayoutSet,
  ) => void;
  setLayouts: (value: NonNullable<Saved["layouts"]>) => void;
  add: (id: string, color?: number, qty?: number) => void;
  addMany: (items: { id: string; color: number }[]) => void;
  openCart: () => void;
  buy: (id: string, color: number, qty: number) => void;
};
const StoreContext = createContext<Store | null>(null);
export function useDemoStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Demo store missing");
  return value;
}
export function DemoDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`demo-dialog${wide ? " wide" : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="demo-dialog-top">
        <h2 id={id}>{title}</h2>
        <button className="d-icon" aria-label="Close dialog" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DemoStore({ children }: { children: ReactNode }) {
  const lastBundle = useRef({ signature: "", pending: false });
  const raw = useSyncExternalStore(subscribe, read, () => null),
    state = (() => {
      try {
        return persistedDemoSchema.parse(JSON.parse(raw ?? "null"));
      } catch {
        return empty;
      }
    })();
  const [panel, setPanel] = useState<
      "cart" | "checkout" | "confirmation" | null
    >(null),
    [reset, setReset] = useState(false),
    [order, setOrder] = useState(""),
    [notice, setNotice] = useState("");
  const pathname = usePathname(),
    router = useRouter(),
    hydrated = useSyncExternalStore(
      subscribe,
      () => true,
      () => false,
    );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const timer = setTimeout(() => {
      lastBundle.current = { signature: "", pending: false };
    }, 800);
    return () => clearTimeout(timer);
  }, [raw]);
  function add(id: string, color = 0, qty = 1) {
    try {
      write({ ...saved(), cart: addToCart(saved().cart, id, color, qty) });
    } catch (error) {
      setNotice(
        error instanceof RangeError
          ? error.message
          : "Your bag is full. Remove an item before adding more.",
      );
      return false;
    }
    setNotice(`${findDemoProduct(id)!.name} added to your bag`);
    return true;
  }
  function addMany(items: { id: string; color: number }[]) {
    const signature = JSON.stringify(items);
    if (
      signature === lastBundle.current.signature &&
      lastBundle.current.pending
    )
      return;
    let next = saved().cart;
    try {
      for (const p of items) next = addToCart(next, p.id, p.color);
    } catch (error) {
      setNotice(
        error instanceof RangeError
          ? error.message
          : "Your bag is full. Remove an item before adding more.",
      );
      return;
    }
    lastBundle.current = { signature, pending: true };
    write({ ...saved(), cart: next });
    setPanel("cart");
  }
  function updateLine(line: CartLine, qty: number) {
    write({
      ...saved(),
      cart: saved().cart.flatMap((l) =>
        l.productId === line.productId && l.color === line.color
          ? qty > 0
            ? [{ ...l, quantity: Math.min(20, qty) }]
            : []
          : [l],
      ),
    });
  }
  const count = state.cart.reduce((s, l) => s + l.quantity, 0),
    total = cartTotal(state.cart);
  return (
    <StoreContext
      value={{
        hydrated,
        cart: state.cart,
        layouts: state.layouts,
        collections: state.collections,
        setCollection: (id, value) =>
          write({
            ...saved(),
            collections: { ...saved().collections, [id]: value },
          }),
        setLayouts: (layouts) => write({ ...saved(), layouts }),
        add,
        addMany,
        openCart: () => setPanel("cart"),
        buy: (id, color, qty) => {
          if (add(id, color, qty)) setPanel("checkout");
        },
      }}
    >
      <div className="demo-store">
        <div className="demo-announcement">
          Interactive shopping by ReScene · Demo checkout, no real payments
        </div>
        <header className="demo-header">
          <Link href="/demo" className="demo-brand">
            <Box size={22} strokeWidth={1.4} /> ReScene<span>Living</span>
          </Link>
          <nav aria-label="Demo experiences">
            <Link
              href="/demo/products"
              aria-current={
                pathname.startsWith("/demo/product") ? "page" : undefined
              }
            >
              Explore a product
            </Link>
            <Link
              href="/demo/spaces"
              aria-current={
                pathname.startsWith("/demo/space") ? "page" : undefined
              }
            >
              Build your space
            </Link>
            <Link
              href="/demo/scenes"
              aria-current={
                pathname === "/demo/scenes" ||
                pathname.startsWith("/demo/shop-the-scene")
                  ? "page"
                  : undefined
              }
            >
              Shop the scene
            </Link>
          </nav>
          <div className="demo-header-actions">
            <ThemeMenu label="Theme" />
            <Link href="/dashboard" className="demo-studio-link">
              <ArrowLeft size={14} /> Studio
            </Link>
            <button
              className="demo-bag"
              aria-label={`Shopping bag, ${count} items`}
              onClick={() => setPanel("cart")}
            >
              <ShoppingBag size={19} />
              <span>{count}</span>
            </button>
          </div>
        </header>
        {children}
        <footer className="demo-footer">
          <div>
            <strong>ReScene Living</strong>
            <p>From a photo to a place you can explore.</p>
          </div>
          <p>
            Demo listings, specifications, colors and reviews are fictional.
            <br />
            Single-photo geometry and materials are approximate. No purchases or
            payments.
          </p>
          <button onClick={() => setReset(true)}>Reset demo</button>
        </footer>
        {notice && (
          <div className="demo-toast" role="status">
            <Check size={17} />
            {notice}
            <button
              onClick={() => {
                setNotice("");
                setPanel("cart");
              }}
            >
              View bag <ArrowRight size={13} />
            </button>
            <button
              className="demo-toast-dismiss"
              aria-label="Dismiss shopping notification"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {reset && (
          <DemoDialog title="Start fresh?" onClose={() => setReset(false)}>
            <p>
              This clears your demo bag and saved arrangements in this browser.
              Your studio projects are kept.
            </p>
            <button
              className="d-button primary"
              onClick={() => {
                write(empty);
                setReset(false);
                router.push("/demo");
              }}
            >
              Reset demo
            </button>
            <button className="d-button" onClick={() => setReset(false)}>
              Keep exploring
            </button>
          </DemoDialog>
        )}
        {panel && (
          <DemoDialog
            title={
              panel === "cart"
                ? `Your bag (${count})`
                : panel === "checkout"
                  ? "Demo checkout"
                  : "Your demo order is confirmed"
            }
            onClose={() => setPanel(null)}
          >
            {panel === "confirmation" ? (
              <div className="demo-order">
                <span className="demo-success">
                  <Check size={30} />
                </span>
                <h3>Your demo order is confirmed</h3>
                <p>Demo order {order}</p>
                <p>No payment was taken and nothing will be shipped.</p>
                <button
                  className="d-button primary"
                  onClick={() => setPanel(null)}
                >
                  Keep exploring
                </button>
              </div>
            ) : (
              <>
                {!state.cart.length ? (
                  <div className="demo-empty">
                    <ShoppingBag size={34} />
                    <h3>Your bag is empty</h3>
                    <p>Explore a product or shop the room to get started.</p>
                    <button
                      className="d-button primary"
                      onClick={() => setPanel(null)}
                    >
                      Continue browsing
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="demo-cart-lines">
                      {state.cart.map((line) => {
                        const p = findDemoProduct(line.productId)!;
                        return (
                          <div
                            className="demo-cart-line"
                            key={`${p.id}:${line.color}`}
                          >
                            <Image
                              src={productCover(p.id)}
                              alt={p.name}
                              width={86}
                              height={92}
                            />
                            <div>
                              <Link
                                href={`/demo/product/${p.id}`}
                                onClick={() => setPanel(null)}
                              >
                                {p.name}
                              </Link>
                              <small>{p.colors[line.color].name}</small>
                              <strong>{money(p.price)}</strong>
                              <div className="demo-quantity">
                                <button
                                  aria-label={`Decrease ${p.name} quantity`}
                                  onClick={() =>
                                    updateLine(line, line.quantity - 1)
                                  }
                                >
                                  <Minus size={13} />
                                </button>
                                <span>{line.quantity}</span>
                                <button
                                  aria-label={`Increase ${p.name} quantity`}
                                  disabled={line.quantity === 20}
                                  onClick={() =>
                                    updateLine(line, line.quantity + 1)
                                  }
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  aria-label={`Remove ${p.name}`}
                                  onClick={() => updateLine(line, 0)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <b>{money(p.price * line.quantity)}</b>
                          </div>
                        );
                      })}
                    </div>
                    {panel === "checkout" && (
                      <div className="demo-checkout-info">
                        <span className="d-kicker">
                          Sample delivery details
                        </span>
                        <strong>Alex Sample</strong>
                        <p>
                          123 Demo Lane, Sample City
                          <br />
                          Standard delivery · Demonstration only
                        </p>
                        <p>No address or payment details needed.</p>
                      </div>
                    )}
                    <div className="demo-totals">
                      <div>
                        <span>Subtotal</span>
                        <strong>{money(total)}</strong>
                      </div>
                      <div>
                        <span>Demo shipping</span>
                        <span>Free</span>
                      </div>
                      <div>
                        <span>Demo taxes</span>
                        <span>$0</span>
                      </div>
                      <div className="grand">
                        <span>Total</span>
                        <strong>{money(total)}</strong>
                      </div>
                    </div>
                    <button
                      className="d-button primary full"
                      onClick={() => {
                        if (panel === "cart") setPanel("checkout");
                        else {
                          setOrder(
                            `RS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                          );
                          write({ ...saved(), cart: [] });
                          setPanel("confirmation");
                        }
                      }}
                    >
                      {panel === "cart"
                        ? "Continue to demo checkout"
                        : "Place demo order"}
                      <ArrowRight size={16} />
                    </button>
                    <p className="demo-fineprint">
                      Interactive demonstration. No payment is collected.
                    </p>
                    {panel === "checkout" && (
                      <button
                        className="d-text"
                        onClick={() => setPanel("cart")}
                      >
                        Back to your bag
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </DemoDialog>
        )}
      </div>
    </StoreContext>
  );
}
