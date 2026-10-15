import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Icon } from "@shared/ui/Icon"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"

export function CheckoutScreen({
  total,
  onClose,
  onPay,
  defaultName = "",
}: {
  total: number;
  onClose: () => void;
  onPay: (customerName: string) => void;
  defaultName?: string;
}) {
  const [customerName, setCustomerName] = useState(defaultName);
  const hasCustomerName = customerName.trim().length > 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasCustomerName) return;
    onPay(customerName.trim());
  };
  return (
    <main className={`${styles["page-screen"]}`}>
      <header
        className={`${styles["page-header"]} ${styles["checkout-header"]}`}
      >
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
      <section
        className={`${styles["express-checkout"]}`}
        aria-labelledby="express-checkout-title"
      >
        <h2 id="express-checkout-title">Express checkout</h2>
        <div className={`${styles["express-options"]}`}>
          <button
            type="button"
            className={`${styles["express-button"]} ${styles["apple-pay"]}`}
            onClick={() => onPay(customerName.trim())}
            disabled={!hasCustomerName}
          >
            <span className={`${styles["apple-mark"]}`} aria-hidden="true">
              ●
            </span>
            Apple Pay
          </button>
          <button
            type="button"
            className={`${styles["express-button"]} google-pay`}
            onClick={() => onPay(customerName.trim())}
            disabled={!hasCustomerName}
          >
            <span className={`${styles["google-mark"]}`} aria-hidden="true">
              G
            </span>
            Pay
          </button>
          <button
            type="button"
            className={`${styles["express-button"]} ${styles["link-pay"]}`}
            onClick={() => onPay(customerName.trim())}
            disabled={!hasCustomerName}
          >
            <span className={`${styles["link-mark"]}`} aria-hidden="true">
              Link
            </span>
          </button>
        </div>
      </section>
      <div className={`${styles["payment-divider"]}`}>
        <span>or pay with card</span>
      </div>
      <div className={`${styles["payment-pill"]}`}>
        <Icon name="card" size={17} /> Credit/Debit Card
      </div>
      <form className={`${styles["payment-form"]}`} onSubmit={submit}>
        <label>
          Card Number:
          <input
            defaultValue="1234 5678 9012 3456"
            inputMode="numeric"
            required
          />
        </label>
        <label>
          Expiration Date:
          <input defaultValue="MM/YY" required />
        </label>
        <label>
          CVV:
          <input defaultValue="123" inputMode="numeric" required />
        </label>
        <div className={`${styles["form-actions"]}`}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" type="submit" disabled={!hasCustomerName}>
            Pay ${total.toFixed(2)}
          </Button>
        </div>
      </form>
    </main>
  );
}
