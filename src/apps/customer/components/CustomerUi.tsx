import styles from "../App.module.css"
import { Icon } from "@shared/ui/Icon"

export function HeaderButton({
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
    <button
      className={`${styles["icon-button"]} ${className ?? ""}`}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
