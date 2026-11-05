import styles from "../App.module.css"
import { Icon } from "@shared/ui/Icon"

export function HeaderButton({
  icon,
  label,
  onClick,
  className,
  expanded,
}: {
  icon: "menu" | "close" | "back";
  label: string;
  onClick: () => void;
  className?: string;
  /** Present for disclosure buttons such as the mobile menu toggle. */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles["icon-button"]} ${className ?? ""}`}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
