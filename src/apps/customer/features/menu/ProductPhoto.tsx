import { useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import type { MenuItem } from "../../types"

/**
 * Menu imagery with a graceful placeholder: a missing or broken Storage URL
 * renders a coffee glyph instead of a broken-image icon.
 */
export function ProductPhoto({
  item,
  large = false,
}: {
  item: MenuItem;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(item.imageUrl) && !failed

  return (
    <div
      className={`${styles["product-photo"]} ${large ? styles["photo-large"] : ""}`}
      role="img"
      aria-label={item.name}
    >
      {showImage ? (
        <img
          src={item.imageUrl ?? ""}
          alt=""
          loading="lazy"
          style={{ objectPosition: item.imagePosition ?? "center" }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`${styles["photo-placeholder"]}`} aria-hidden="true">
          <Icon name="coffee" size={large ? 34 : 22} />
        </span>
      )}
    </div>
  )
}
