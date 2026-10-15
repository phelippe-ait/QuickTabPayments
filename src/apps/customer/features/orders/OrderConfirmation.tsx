import { type FormEvent, useEffect, useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"
import { orderStatuses, tableNumber } from "../../data/menu"

export function OrderConfirmation({
  customerName,
  isLoggedIn,
  onClose,
  onLogin,
  onSignup,
}: {
  customerName: string;
  isLoggedIn: boolean;
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
        <HeaderButton
          icon="close"
          label="Close confirmation"
          onClick={onClose}
        />
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
              <span
                className={`${styles["status-marker"]}`}
                aria-hidden="true"
              />
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
      {!isLoggedIn && (
        <section className={`${styles["account-prompt"]}`}>
          <h2>Save your details</h2>
          <p>Create an account or log in to make your next order faster.</p>
          <div>
            <Button
              variant="outline"
              fullWidth
              className="text-[10px]"
              onClick={onSignup}
            >
              Create account
            </Button>
            <Button
              variant="secondary"
              fullWidth
              className="text-[10px]"
              onClick={onLogin}
            >
              Log in
            </Button>
          </div>
        </section>
      )}
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
        <Button
          variant="outline"
          fullWidth
          type="submit"
          disabled={!receiptContact.trim()}
        >
          Send Receipt
        </Button>
        {receiptConfirmed && (
          <p className={`${styles["receipt-confirmed"]}`}>
            Receipt contact confirmed.
          </p>
        )}
      </form>
    </main>
  );
}
