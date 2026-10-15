import styles from "../../App.module.css"
import type { Product } from "../../types"

export function ProductPhoto({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
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
