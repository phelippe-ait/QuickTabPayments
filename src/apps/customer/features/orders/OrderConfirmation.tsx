import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { HeaderButton } from "../../components/CustomerUi"

export function OrderConfirmation({
  customerName,
  orderNumber,
  isLoggedIn,
  onClose,
  onLogin,
  onSignup,
}: {
  customerName: string;
  orderNumber: string;
  isLoggedIn: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSignup: () => void;
}) {
  const [receiptContact, setReceiptContact] = useState("");
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
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
      <div className={`${styles["order-number"]}`}>{orderNumber}</div>
      <section className={`${styles["order-status"]}`}>
        <h2>Order status</h2>
        <p className={`${styles["status-message"]}`} aria-live="polite">
          Your order is pending and has been saved.
        </p>
      </section>
      <section>
        <h2>Payment</h2>
        <p>Pay at the counter when you collect your order.</p>
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
