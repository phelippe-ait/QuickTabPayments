import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"

export function OrdersScreen({ onClose }: { onClose: () => void }) {
  return (
    <main className={`${styles["page-screen"]}`}>
      <header className={`${styles["page-header"]}`}>
        <h1>My orders</h1>
        <HeaderButton
          icon="close"
          label="Close order history"
          onClick={onClose}
        />
      </header>
      <div className={`${styles["empty-cart"]}`}>
        <span className={`${styles["large-cart"]}`}>
          <Icon name="receipt" size={34} />
        </span>
        <h2>No orders yet</h2>
        <p>Your past orders will show up here once you place one.</p>
        <Button variant="outline" className="w-auto px-6" onClick={onClose}>
          Browse menu
        </Button>
      </div>
    </main>
  );
}
