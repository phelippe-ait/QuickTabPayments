import { type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";
import { Icon } from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";

type Screen = "menu" | "cart" | "checkout" | "confirmation" | "login" | "signup";
type Category = "Hot Beverages" | "Breakfast" | "Lunch";

type Product = {
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  imagePosition?: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

const products: Product[] = [
  {
    name: "Flat White",
    description: "Smooth, creamy, and just the right amount of coffee kick.",
    price: 4.7,
    category: "Hot Beverages",
    image: "/assets/flat-white.jpg",
    imagePosition: "56% center",
  },
  {
    name: "Babyccino",
    description:
      "A frothy, steamed milk beverage for kids, often topped with a sprinkle of cocoa or cinnamon.",
    price: 2.5,
    category: "Hot Beverages",
    image: "/assets/babyccino.jpg",
  },
  {
    name: "Mocha",
    description:
      "A delicious blend of espresso, chocolate, and steamed milk. A sweet indulgence.",
    price: 5,
    category: "Hot Beverages",
    image: "/assets/mocha.jpg",
    imagePosition: "56% center",
  },
  {
    name: "Cappuccino",
    description: "Silky, rich, and deeply chocolatey with a generous cap of foam.",
    price: 4.5,
    category: "Hot Beverages",
    image: "/assets/cappuccino.jpg",
    imagePosition: "center 57%",
  },
  {
    name: "Avocado Toast",
    description: "Sourdough toast with smashed avocado, feta, herbs, and lemon.",
    price: 11.5,
    category: "Breakfast",
    image:
      "/assets/avocado-toast.jpg",
  },
  {
    name: "Berry Pancakes",
    description: "Fluffy pancakes with seasonal berries, maple syrup, and whipped butter.",
    price: 12,
    category: "Breakfast",
    image:
      "/assets/berry-pancakes.jpg",
  },
  {
    name: "Butter Croissant",
    description: "A flaky, golden croissant served warm with cultured butter and jam.",
    price: 5.5,
    category: "Breakfast",
    image:
      "/assets/butter-croissant.jpg",
  },
  {
    name: "Chicken Club",
    description: "Roast chicken, crisp lettuce, tomato, bacon, and herb mayo on toasted bread.",
    price: 13.5,
    category: "Lunch",
    image:
      "/assets/chicken-club.jpg",
  },
  {
    name: "Garden Salad",
    description: "Seasonal greens, cucumber, tomato, avocado, and a bright lemon dressing.",
    price: 12.5,
    category: "Lunch",
    image:
      "/assets/garden-salad.jpg",
  },
  {
    name: "Pesto Panini",
    description: "Toasted panini with mozzarella, tomato, basil pesto, and a crisp side salad.",
    price: 14,
    category: "Lunch",
    image:
      "/assets/pesto-panini.jpg",
  },
];

const categories: Category[] = ["Hot Beverages", "Breakfast", "Lunch"];
const tableNumber = 3;

const orderStatuses = [
  {
    label: "Order confirmed",
    message: "We’ve received your order and sent it to the kitchen.",
  },
  {
    label: "Preparing order",
    message: "The kitchen is preparing your order now.",
  },
  {
    label: "Order ready",
    message: "Your order is ready to collect.",
  },
] as const;

function HeaderButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: "menu" | "close" | "back";
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button className={`${styles["icon-button"]} ${className ?? ""}`} aria-label={label} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

function ProductPhoto({ product, large = false }: { product: Product; large?: boolean }) {
  return (
    <div
      className={`${styles["product-photo"]} ${large ? styles["photo-large"] : ""}`}
      style={{
        backgroundImage: `url("${product.image}")`,
        backgroundPosition: product.imagePosition ?? "center",
      }}
      role="img"
      aria-label={product.name}
    />
  );
}

function MenuScreen({
  cartCount,
  total,
  onOpenCart,
  onSelect,
  onAuth,
}: {
  cartCount: number;
  total: number;
  onOpenCart: () => void;
  onSelect: (product: Product) => void;
  onAuth: (screen: "login" | "signup") => void;
}) {
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Hot Beverages");

  const chooseCategory = (category: Category) => {
    setActiveCategory(category);
    setDrawer(false);
    requestAnimationFrame(() => {
      document
        .getElementById(`category-${category.toLowerCase().replace(" ", "-")}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const sections = categories
      .map((category) =>
        document.getElementById(`category-${category.toLowerCase().replace(" ", "-")}`),
      )
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveCategory((visible.target as HTMLElement).dataset.category as Category);
      },
      { rootMargin: "-105px 0px -65% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {drawer && (
        <button className={`${styles["drawer-shade"]}`} aria-label="Close menu" onClick={() => setDrawer(false)} />
      )}
      <aside className={`${styles["drawer"]} ${drawer ? styles["open"] : ""}`}>
        <div className={`${styles["drawer-heading"]}`}>
          <div>
            <span className={`${styles["eyebrow"]}`}>CAFÉ SHOP</span>
            <h2>Welcome</h2>
          </div>
          <HeaderButton className={styles["drawer-close"]} icon="close" label="Close menu" onClick={() => setDrawer(false)} />
        </div>
        <nav className={`${styles["drawer-categories"]}`} aria-label="Menu categories">
          <span>Menu categories</span>
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? styles["active"] : ""}
              onClick={() => chooseCategory(category)}
            >
              {category}
            </button>
          ))}
        </nav>
        <div className={`${styles["drawer-auth"]}`}>
          <Button variant="primary" fullWidth className="h-[43px] text-[11px]" onClick={() => onAuth("signup")}>
            Sign up
          </Button>
          <Button variant="outline" fullWidth className="h-[43px] text-[11px]" onClick={() => onAuth("login")}>
            Log in
          </Button>
        </div>
        <div className={`${styles["drawer-links"]}`}>
          <span>Our menu</span>
          <span>Find a café</span>
          <span>Help &amp; support</span>
        </div>
      </aside>

      <main className={`${styles["menu-screen"]}`}>
        <header className={`${styles["menu-header"]}`}>
          <HeaderButton className={styles["menu-toggle"]} icon="menu" label="Open menu" onClick={() => setDrawer(true)} />
          <span className={`${styles["menu-brand"]}`}>Café Shop</span>
        </header>

        <section className={`${styles["hero"]}`} aria-label="Cafe Shop">
          <span className="absolute right-3 top-3 rounded-full bg-cream/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-berry-alt shadow-sm backdrop-blur-sm">
            Table {tableNumber}
          </span>
        </section>

        <div className={`${styles["search-row"]}`}>
          <label className={`${styles["search-field"]}`}>
            <Icon name="search" size={17} />
            <input
              aria-label="Search beverages"
              placeholder="Search item"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <nav className={`${styles["category-tabs"]}`} aria-label="Browse menu categories">
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? styles["active"] : ""}
              onClick={() => chooseCategory(category)}
            >
              {category}
            </button>
          ))}
        </nav>

        {categories.map((category) => {
          const categoryProducts = products.filter(
            (product) =>
              product.category === category &&
              product.name.toLowerCase().includes(search.toLowerCase()),
          );

          return (
            <section
              className={`${styles["products-section"]}`}
              id={`category-${category.toLowerCase().replace(" ", "-")}`}
              data-category={category}
              key={category}
            >
              <h1>{category}</h1>
              <div className={`${styles["product-list"]}`}>
                {categoryProducts.map((product) => (
                  <button
                    className={`${styles["product-card"]}`}
                    key={product.name}
                    onClick={() => onSelect(product)}
                  >
                    <span className={`${styles["product-copy"]}`}>
                      <strong>{product.name}</strong>
                      <span>{product.description}</span>
                      <em>${product.price.toFixed(2)}</em>
                    </span>
                    <ProductPhoto product={product} />
                  </button>
                ))}
                {categoryProducts.length === 0 && (
                  <p className={`${styles["empty-search"]}`}>No matching items in this section.</p>
                )}
              </div>
            </section>
          );
        })}

        <button className={`${styles["cart-dock"]}`} onClick={onOpenCart}>
          <span>
            <strong>Cart</strong>
            <small>
              {cartCount
                ? `${cartCount} item(s) in your cart - Total: $${total.toFixed(2)}`
                : "Your cart is empty."}
            </small>
          </span>
          <span className={`${styles["cart-icon"]}`}>
            <Icon name="cart" />
          </span>
        </button>
      </main>
    </>
  );
}

function ProductModal({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className={`${styles["modal-shade"]}`}>
      <section className={`${styles["product-modal"]}`} role="dialog" aria-modal="true" aria-label={product.name}>
        <div className={`${styles["modal-close"]}`}>
          <HeaderButton icon="close" label="Close product details" onClick={onClose} />
        </div>
        <ProductPhoto product={product} large />
        <h2>{product.name}</h2>
        <p>{product.description}</p>
        <div className={`${styles["modal-price"]}`}>${product.price.toFixed(2)}</div>
        {product.category === "Hot Beverages" && (
          <>
            <label className={`${styles["option-row"]}`}>
              <span>Size</span>
              <select defaultValue="Regular"><option>Regular</option><option>Large</option></select>
            </label>
            <label className={`${styles["option-row"]}`}>
              <span>Choice of milk</span>
              <select defaultValue="Full Cream Milk">
                <option>Full Cream Milk</option>
                <option>Oat Milk</option>
                <option>Almond Milk</option>
              </select>
            </label>
          </>
        )}
        <label className={`${styles["instructions"]}`}>
          <span>Special Instructions:</span>
          <textarea placeholder="e.g., no ice, extra hot, etc." />
        </label>
        <div className={`${styles["modal-footer"]}`}>
          <div className={`${styles["quantity"]}`}>
            <button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
            <span>{quantity}</span>
            <button aria-label="Increase quantity" onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>
          <Button variant="outline" size="sm" className="rounded-[5px]" onClick={() => onAdd(quantity)}>Add to Order</Button>
        </div>
      </section>
    </div>
  );
}

function CartScreen({
  items,
  total,
  onClose,
  onRemove,
  onDecrease,
  onIncrease,
  onCheckout,
}: {
  items: CartItem[];
  total: number;
  onClose: () => void;
  onRemove: (productName: string) => void;
  onDecrease: (productName: string) => void;
  onIncrease: (productName: string) => void;
  onCheckout: () => void;
}) {
  return (
    <main className={`${styles["page-screen"]} cart-screen`}>
      <header className={`${styles["page-header"]}`}>
        <h1>Review Your Order</h1>
        <HeaderButton icon="close" label="Close cart" onClick={onClose} />
      </header>
      {items.length > 0 ? (
        items.map(({ product, quantity }) => (
          <article className={`${styles["order-card"]}`} key={product.name}>
            <div>
              <span className={`${styles["item-name"]}`}>
                <span>{product.name}</span>
                <small>${product.price.toFixed(2)} each</small>
              </span>
              <span>${(product.price * quantity).toFixed(2)}</span>
            </div>
            <div>
              <span className={`${styles["qty-pill"]}`}>
                <button
                  aria-label={`Decrease ${product.name} quantity`}
                  onClick={() => onDecrease(product.name)}
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  aria-label={`Increase ${product.name} quantity`}
                  onClick={() => onIncrease(product.name)}
                >
                  +
                </button>
              </span>
              <button onClick={() => onRemove(product.name)}>Remove</button>
            </div>
          </article>
        ))
      ) : (
        <div className={`${styles["empty-cart"]}`}>
          <span className={`${styles["large-cart"]}`}><Icon name="cart" size={34} /></span>
          <h2>Your cart is empty</h2>
          <p>Add a drink from our hot beverage menu.</p>
          <Button variant="outline" className="w-auto px-6" onClick={onClose}>Browse menu</Button>
        </div>
      )}
      <div className={`${styles["checkout-dock"]}`}>
        <strong>Total: ${total.toFixed(2)}</strong>
        <button disabled={!items.length} onClick={onCheckout}>Checkout</button>
      </div>
    </main>
  );
}

function CheckoutScreen({
  total,
  onClose,
  onPay,
}: {
  total: number;
  onClose: () => void;
  onPay: (customerName: string) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const hasCustomerName = customerName.trim().length > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasCustomerName) return;
    onPay(customerName.trim());
  };
  return (
    <main className={`${styles["page-screen"]}`}>
      <header className={`${styles["page-header"]} ${styles["checkout-header"]}`}>
        <h1>Checkout</h1>
        <HeaderButton icon="close" label="Close checkout" onClick={onClose} />
      </header>
      <label className={`${styles["checkout-field"]}`}>
        <span>Customer name</span>
        <input
          type="text"
          autoComplete="name"
          placeholder="Enter customer name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          required
        />
      </label>
      <section className={`${styles["express-checkout"]}`} aria-labelledby="express-checkout-title">
        <h2 id="express-checkout-title">Express checkout</h2>
        <div className={`${styles["express-options"]}`}>
          <button type="button" className={`${styles["express-button"]} ${styles["apple-pay"]}`} onClick={() => onPay(customerName.trim())} disabled={!hasCustomerName}>
            <span className={`${styles["apple-mark"]}`} aria-hidden="true">●</span>
            Apple Pay
          </button>
          <button type="button" className={`${styles["express-button"]} google-pay`} onClick={() => onPay(customerName.trim())} disabled={!hasCustomerName}>
            <span className={`${styles["google-mark"]}`} aria-hidden="true">G</span>
            Pay
          </button>
          <button type="button" className={`${styles["express-button"]} ${styles["link-pay"]}`} onClick={() => onPay(customerName.trim())} disabled={!hasCustomerName}>
            <span className={`${styles["link-mark"]}`} aria-hidden="true">Link</span>
          </button>
        </div>
      </section>
      <div className={`${styles["payment-divider"]}`}><span>or pay with card</span></div>
      <div className={`${styles["payment-pill"]}`}><Icon name="card" size={17} /> Credit/Debit Card</div>
      <form className={`${styles["payment-form"]}`} onSubmit={submit}>
        <label>Card Number:<input defaultValue="1234 5678 9012 3456" inputMode="numeric" required /></label>
        <label>Expiration Date:<input defaultValue="MM/YY" required /></label>
        <label>CVV:<input defaultValue="123" inputMode="numeric" required /></label>
        <div className={`${styles["form-actions"]}`}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="outline" type="submit" disabled={!hasCustomerName}>Pay ${total.toFixed(2)}</Button>
        </div>
      </form>
    </main>
  );
}

function Confirmation({
  customerName,
  onClose,
  onLogin,
  onSignup,
}: {
  customerName: string;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}) {
  const [receiptContact, setReceiptContact] = useState("");
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (statusIndex >= orderStatuses.length - 1) return;
    const timer = window.setTimeout(
      () => setStatusIndex((current) => current + 1),
      5000,
    );
    return () => window.clearTimeout(timer);
  }, [statusIndex]);

  const confirmReceipt = (event: FormEvent) => {
    event.preventDefault();
    if (receiptContact.trim()) setReceiptConfirmed(true);
  };

  return (
    <main className={`${styles["page-screen"]} ${styles["confirmation"]}`}>
      <header className={`${styles["confirmation-header"]}`}>
        <span>Order Confirmation</span>
        <HeaderButton icon="close" label="Close confirmation" onClick={onClose} />
      </header>
      <h1>{customerName}</h1>
      <strong>Your order number:</strong>
      <div className={`${styles["order-number"]}`}>ORD-94967</div>
      <div className={`${styles["table-number"]}`}>
        <span>Table</span>
        <strong>{tableNumber}</strong>
      </div>
      <section className={`${styles["order-status"]}`}>
        <h2>Order status</h2>
        <ol className={`${styles["status-timeline"]}`}>
          {orderStatuses.map((status, index) => (
            <li
              key={status.label}
              className={
                index < statusIndex
                  ? styles["complete"]
                  : index === statusIndex
                    ? styles["current"]
                    : ""
              }
              aria-current={index === statusIndex ? "step" : undefined}
            >
              <span className={`${styles["status-marker"]}`} aria-hidden="true" />
              <span>{status.label}</span>
            </li>
          ))}
        </ol>
        <p className={`${styles["status-message"]}`} aria-live="polite">
          {orderStatuses[statusIndex].message}
        </p>
      </section>
      <section>
        <h2>Location</h2>
        <p>Café Shop</p>
        <p>123 Main St</p>
        <p>Sydney CBD, NSW 2000</p>
      </section>
      <section className={`${styles["account-prompt"]}`}>
        <h2>Save your details</h2>
        <p>Create an account or log in to make your next order faster.</p>
        <div>
          <Button variant="outline" fullWidth className="text-[10px]" onClick={onSignup}>
            Create account
          </Button>
          <Button variant="secondary" fullWidth className="text-[10px]" onClick={onLogin}>
            Log in
          </Button>
        </div>
      </section>
      <footer>Thank you for your order</footer>
      <form className={`${styles["receipt-form"]}`} onSubmit={confirmReceipt}>
        <label className={`${styles["receipt-contact"]}`}>
          <span>Email or phone number for receipt</span>
          <input
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="Email address or phone number"
            value={receiptContact}
            onChange={(event) => {
              setReceiptContact(event.target.value);
              setReceiptConfirmed(false);
            }}
            required
          />
        </label>
        <Button variant="outline" fullWidth type="submit" disabled={!receiptContact.trim()}>
          Send Receipt
        </Button>
        {receiptConfirmed && <p className={`${styles["receipt-confirmed"]}`}>Receipt contact confirmed.</p>}
      </form>
    </main>
  );
}

function AuthScreen({
  kind,
  onBack,
  onContinue,
}: {
  kind: "login" | "signup";
  onBack: () => void;
  onContinue: () => void;
}) {
  const signup = kind === "signup";
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  // Each provider will map to `supabase.auth.signInWithOAuth({ provider })`;
  // the form below is the email/password path. Both currently just continue the flow.
  const providers = [
    { id: "apple", label: "Apple" },
    { id: "google", label: "Google" },
    { id: "facebook", label: "Facebook" },
  ] as const;

  return (
    <main className={`${styles["page-screen"]} auth-screen`}>
      <header className={`${styles["page-header"]} ${styles["auth-header"]}`}>
        <HeaderButton icon="back" label="Back to order confirmation" onClick={onBack} />
        <h1>{signup ? "Create account" : "Log in"}</h1>
        <span className={`${styles["auth-header-spacer"]}`} aria-hidden="true" />
      </header>
      <p className={`${styles["auth-intro"]}`}>
        {signup
          ? "Create your account to order faster next time — with Apple, Google, Facebook, or email."
          : "Welcome back. Continue with Apple, Google, Facebook, or email."}
      </p>
      <div className={`${styles["auth-social"]}`}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className={`${styles["auth-social-button"]}`}
            onClick={onContinue}
          >
            <Icon name={provider.id} size={18} />
            <span>
              {signup ? "Sign up" : "Log in"} with {provider.label}
            </span>
          </button>
        ))}
      </div>
      <div className={`${styles["auth-divider"]}`} role="separator">
        <span>or continue with email</span>
      </div>
      <form
        className={`${styles["auth-form"]}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (signup && password !== passwordConfirmation) {
            setPasswordError("Passwords do not match.");
            return;
          }
          onContinue();
        }}
      >
        {signup && (
          <div className={`${styles["auth-name-row"]}`}>
            <label>
              First name
              <input type="text" autoComplete="given-name" required />
            </label>
            <label>
              Last name
              <input type="text" autoComplete="family-name" required />
            </label>
          </div>
        )}
        <label>
          Email
          <input type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError("");
            }}
            required
          />
        </label>
        {signup && (
          <label>
            Re-enter password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirmation}
              onChange={(event) => {
                setPasswordConfirmation(event.target.value);
                setPasswordError("");
              }}
              aria-describedby={passwordError ? "password-error" : undefined}
              required
            />
          </label>
        )}
        {passwordError && (
          <p className={`${styles["auth-error"]}`} id="password-error" role="alert">
            {passwordError}
          </p>
        )}
        <Button variant="outline" fullWidth type="submit" className="mt-1">
          {signup ? "Create account" : "Log in"}
        </Button>
      </form>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [authReturnScreen, setAuthReturnScreen] = useState<"menu" | "confirmation">("menu");
  const cartItems = useMemo(
    () =>
      products
        .filter((product) => (cart[product.name] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.name] })),
    [cart],
  );
  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems],
  );
  const total = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [cartItems],
  );

  const menu = () => setScreen("menu");

  return (
    <div className={`${styles["app-shell"]} ${screen === "menu" ? styles["with-sidebar"] : ""}`}>
      {screen === "menu" && (
        <MenuScreen
          cartCount={cartCount}
          total={total}
          onOpenCart={() => setScreen("cart")}
          onSelect={setSelected}
          onAuth={(authScreen) => {
            setAuthReturnScreen("menu");
            setScreen(authScreen);
          }}
        />
      )}
      {screen === "cart" && (
        <CartScreen
          items={cartItems}
          total={total}
          onClose={menu}
          onRemove={(productName) =>
            setCart((current) => {
              const next = { ...current };
              delete next[productName];
              return next;
            })
          }
          onDecrease={(productName) =>
            setCart((current) => ({
              ...current,
              [productName]: Math.max(0, (current[productName] ?? 0) - 1),
            }))
          }
          onIncrease={(productName) =>
            setCart((current) => ({
              ...current,
              [productName]: (current[productName] ?? 0) + 1,
            }))
          }
          onCheckout={() => setScreen("checkout")}
        />
      )}
      {screen === "checkout" && (
        <CheckoutScreen
          total={total}
          onClose={() => setScreen("cart")}
          onPay={(name) => {
            setCustomerName(name);
            setScreen("confirmation");
          }}
        />
      )}
      {screen === "confirmation" && (
        <Confirmation
          customerName={customerName}
          onLogin={() => {
            setAuthReturnScreen("confirmation");
            setScreen("login");
          }}
          onSignup={() => {
            setAuthReturnScreen("confirmation");
            setScreen("signup");
          }}
          onClose={() => {
            setCart({});
            setCustomerName("");
            menu();
          }}
        />
      )}
      {(screen === "login" || screen === "signup") && (
        <AuthScreen
          kind={screen}
          onBack={() => setScreen(authReturnScreen)}
          onContinue={() => setScreen(authReturnScreen)}
        />
      )}
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={(amount) => {
            setCart((current) => ({
              ...current,
              [selected.name]: (current[selected.name] ?? 0) + amount,
            }));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
