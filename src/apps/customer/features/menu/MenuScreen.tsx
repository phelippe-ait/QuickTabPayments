import { useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { useAuth } from "@shared/auth/AuthContext"
import { HeaderButton } from "../../components/CustomerUi"
import { EditNameDialog } from "../profile/EditNameDialog"
import { ProductPhoto } from "./ProductPhoto"
import { categories, products, tableNumber } from "../../data/menu"
import type { Category, Product } from "../../types"

export function MenuScreen({
  cartCount,
  total,
  onOpenCart,
  onOpenOrders,
  onSelect,
  onAuth,
}: {
  cartCount: number;
  total: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onSelect: (product: Product) => void;
  onAuth: (screen: "login" | "signup") => void;
}) {
  const { user, profile, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<Category>("Hot Beverages");

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
        document.getElementById(
          `category-${category.toLowerCase().replace(" ", "-")}`,
        ),
      )
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible)
          setActiveCategory(
            (visible.target as HTMLElement).dataset.category as Category,
          );
      },
      { rootMargin: "-105px 0px -65% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

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
            <span className={`${styles["eyebrow"]}`}>CAFÉ SHOP</span>
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
              key={category}
              className={activeCategory === category ? styles["active"] : ""}
              onClick={() => chooseCategory(category)}
            >
              {category}
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

        <nav
          className={`${styles["category-tabs"]}`}
          aria-label="Browse menu categories"
        >
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
                  <p className={`${styles["empty-search"]}`}>
                    No matching items in this section.
                  </p>
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
