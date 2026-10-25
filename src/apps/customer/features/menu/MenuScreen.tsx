import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { useAuth } from "@shared/auth/AuthContext"
import { formatMoney } from "@shared/lib/money"
import { HeaderButton } from "../../components/CustomerUi"
import { EditNameDialog } from "../profile/EditNameDialog"
import { ProductPhoto } from "./ProductPhoto"
import { fetchMenu } from "../../data/menuApi"
import type { MenuItem, QrContext } from "../../types"

export function MenuScreen({
  qr,
  cartCount,
  total,
  onOpenCart,
  onOpenOrders,
  onSelect,
  onAuth,
  onReconcile,
}: {
  qr: QrContext;
  cartCount: number;
  total: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onSelect: (item: MenuItem) => void;
  onAuth: (screen: "login" | "signup") => void;
  onReconcile: (items: MenuItem[]) => void;
}) {
  const { user, profile, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");

  const menuQuery = useQuery({
    queryKey: ["customer-menu", qr.restaurantId],
    queryFn: () => fetchMenu(qr.restaurantId),
    staleTime: 30_000,
  });
  const categories = useMemo(() => menuQuery.data ?? [], [menuQuery.data]);

  // Keep the cart aligned with the live menu (removed/sold-out items, price
  // changes). Runs once per successful menu load.
  useEffect(() => {
    if (!menuQuery.data) return;
    onReconcile(menuQuery.data.flatMap((category) => category.items));
  }, [menuQuery.data, onReconcile]);

  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((category) => document.getElementById(`category-${category.id}`))
      .filter((section): section is HTMLElement => Boolean(section));
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setActiveCategory((visible.target as HTMLElement).dataset.category ?? "");
        }
      },
      { rootMargin: "-105px 0px -65% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  const currentCategory =
    categories.find((category) => category.id === activeCategory)?.id ??
    categories[0]?.id ??
    "";

  const accountName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "";
  const accountInitials =
    accountName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U";

  const chooseCategory = (id: string) => {
    setActiveCategory(id);
    setDrawer(false);
    requestAnimationFrame(() => {
      document
        .getElementById(`category-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const normalisedSearch = search.trim().toLowerCase();
  const matching = (item: MenuItem) =>
    !normalisedSearch ||
    item.name.toLowerCase().includes(normalisedSearch) ||
    item.description.toLowerCase().includes(normalisedSearch);

  return (
    <>
      {drawer && (
        <button
          className={`${styles["drawer-shade"]}`}
          aria-label="Close menu"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`${styles["drawer"]} ${drawer ? styles["open"] : ""}`}>
        <div className={`${styles["drawer-heading"]}`}>
          <div>
            <span className={`${styles["eyebrow"]}`}>SCAN &amp; ORDER</span>
            <h2>Welcome</h2>
          </div>
          <HeaderButton
            className={styles["drawer-close"]}
            icon="close"
            label="Close menu"
            onClick={() => setDrawer(false)}
          />
        </div>
        <nav
          className={`${styles["drawer-categories"]}`}
          aria-label="Menu categories"
        >
          <span>Menu categories</span>
          {categories.map((category) => (
            <button
              key={category.id}
              className={currentCategory === category.id ? styles["active"] : ""}
              onClick={() => chooseCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
        {user ? (
          <div className={`${styles["drawer-account"]}`}>
            <div className={`${styles["drawer-account-head"]}`}>
              <span className={`${styles["drawer-avatar"]}`} aria-hidden="true">
                {accountInitials}
              </span>
              <span className={`${styles["drawer-account-name"]}`}>
                <strong>{accountName || "Signed in"}</strong>
                <small>{user.email}</small>
              </span>
              <button
                type="button"
                className={`${styles["drawer-edit"]}`}
                aria-label="Edit name"
                title="Edit name"
                onClick={() => setEditingName(true)}
              >
                <Icon name="edit" size={15} />
              </button>
            </div>
            <button
              type="button"
              className={`${styles["drawer-account-link"]}`}
              onClick={onOpenOrders}
            >
              <Icon name="receipt" size={16} />
              Order history
            </button>
            <button
              type="button"
              className={`${styles["drawer-logout"]}`}
              onClick={() => void signOut()}
            >
              <Icon name="logout" size={16} />
              Log out
            </button>
          </div>
        ) : (
          <div className={`${styles["drawer-auth"]}`}>
            <Button
              variant="primary"
              fullWidth
              className="h-[43px] text-[11px]"
              onClick={() => onAuth("signup")}
            >
              Sign up
            </Button>
            <Button
              variant="outline"
              fullWidth
              className="h-[43px] text-[11px]"
              onClick={() => onAuth("login")}
            >
              Log in
            </Button>
          </div>
        )}
        <div className={`${styles["drawer-links"]}`}>
          <span>Our menu</span>
          <span>Find a café</span>
          <span>Help &amp; support</span>
        </div>
      </aside>

      <main className={`${styles["menu-screen"]}`}>
        <header className={`${styles["menu-header"]}`}>
          <HeaderButton
            className={styles["menu-toggle"]}
            icon="menu"
            label="Open menu"
            onClick={() => setDrawer(true)}
          />
          <span className={`${styles["menu-brand"]}`}>{qr.restaurantName}</span>
        </header>

        <section
          className={`${styles["hero"]}`}
          aria-label={`${qr.restaurantName} menu`}
        >
          <span className="absolute right-3 top-3 rounded-full bg-cream/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-berry-alt shadow-sm backdrop-blur-sm">
            Table {qr.tableNumber}
          </span>
        </section>

        <div className={`${styles["search-row"]}`}>
          <label className={`${styles["search-field"]}`}>
            <Icon name="search" size={17} />
            <input
              aria-label="Search menu"
              placeholder="Search item"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {menuQuery.isPending ? (
          <section aria-label="Loading menu" role="status" className="space-y-3 pb-10">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-[112px] animate-pulse rounded-lg border border-line-2 bg-paper"
              />
            ))}
            <span className="sr-only">Loading the menu…</span>
          </section>
        ) : menuQuery.isError ? (
          <section
            className="rounded-card border border-line bg-paper p-8 text-center shadow-card"
            role="alert"
          >
            <h2 className="font-serif text-xl text-ink">
              We couldn&apos;t load the menu
            </h2>
            <p className="mt-2 text-sm text-ink-mid">
              {menuQuery.error instanceof Error
                ? menuQuery.error.message
                : "Please check your connection and try again."}
            </p>
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => void menuQuery.refetch()}
            >
              Try again
            </Button>
          </section>
        ) : categories.length === 0 ? (
          <section className="rounded-card border border-line bg-paper p-8 text-center shadow-card">
            <h2 className="font-serif text-xl text-ink">
              This restaurant hasn&apos;t published its menu yet
            </h2>
            <p className="mt-2 text-sm text-ink-mid">
              Please ask a team member for help, or try again shortly.
            </p>
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => void menuQuery.refetch()}
            >
              Refresh menu
            </Button>
          </section>
        ) : (
          <>
            <nav
              className={`${styles["category-tabs"]}`}
              aria-label="Browse menu categories"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={
                    currentCategory === category.id ? styles["active"] : ""
                  }
                  onClick={() => chooseCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </nav>

            {categories.map((category) => {
              const items = category.items.filter(matching);

              return (
                <section
                  className={`${styles["products-section"]}`}
                  id={`category-${category.id}`}
                  data-category={category.id}
                  key={category.id}
                >
                  <h1>{category.name}</h1>
                  <div className={`${styles["product-list"]}`}>
                    {items.map((item) => (
                      <button
                        className={`${styles["product-card"]}`}
                        key={item.id}
                        onClick={() => onSelect(item)}
                      >
                        <span className={`${styles["product-copy"]}`}>
                          <strong>{item.name}</strong>
                          <span>{item.description}</span>
                          <em>{formatMoney(item.price, qr.currency)}</em>
                        </span>
                        <ProductPhoto item={item} />
                      </button>
                    ))}
                    {items.length === 0 && (
                      <p className={`${styles["empty-search"]}`}>
                        No matching items in this section.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </>
        )}

        <button className={`${styles["cart-dock"]}`} onClick={onOpenCart}>
          <span>
            <strong>Cart</strong>
            <small>
              {cartCount
                ? `${cartCount} item(s) in your cart - Total: ${formatMoney(total, qr.currency)}`
                : "Your cart is empty."}
            </small>
          </span>
          <span className={`${styles["cart-icon"]}`}>
            <Icon name="cart" />
          </span>
        </button>
      </main>

      {editingName && (
        <EditNameDialog
          defaultFirstName={profile?.first_name ?? ""}
          defaultLastName={profile?.last_name ?? ""}
          onClose={() => setEditingName(false)}
        />
      )}
    </>
  );
}
