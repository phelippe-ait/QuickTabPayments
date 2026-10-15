import { type FormEvent, useState } from "react"
import styles from "../../App.module.css"
import { Button } from "@shared/ui/Button"
import { useAuth } from "@shared/auth/AuthContext"
import { HeaderButton } from "../../components/CustomerUi"

export function EditNameDialog({
  defaultFirstName,
  defaultLastName,
  onClose,
}: {
  defaultFirstName: string;
  defaultLastName: string;
  onClose: () => void;
}) {
  const { updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: saveError } = await updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onClose();
  };

  return (
    <div className={`${styles["modal-shade"]}`}>
      <form
        className={`${styles["product-modal"]}`}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Edit name"
      >
        <div className={`${styles["modal-close"]}`}>
          <HeaderButton icon="close" label="Close" onClick={onClose} />
        </div>
        <h2>Edit your name</h2>
        <label className={`${styles["checkout-field"]}`}>
          <span>First name</span>
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </label>
        <label className={`${styles["checkout-field"]}`}>
          <span>Last name</span>
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </label>
        {error && (
          <p className={`${styles["auth-error"]}`} role="alert">
            {error}
          </p>
        )}
        <div className={`${styles["modal-footer"]}`}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
