import { useState } from "react";
import styles from "../App.module.css";
import { Icon } from "../../../shared/ui/Icon";
import { supabase } from "../../../shared/lib/supabase";

export default function GoogleLoginButton() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://quick-tab-payments.vercel.app/",
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
    }
    // On success, Supabase redirects the browser to Google.
  };

  return (
    <div className={styles["google-login"]}>
      <button
        type="button"
        className={`${styles["express-button"]} ${styles["google-login-button"]}`}
        onClick={handleGoogleLogin}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <span className={styles["google-login-spinner"]} aria-hidden="true" />
        ) : (
          <Icon name="google" size={17} />
        )}
        <span>{loading ? "Redirecting…" : "Continue with Google"}</span>
      </button>

      {errorMessage && (
        <p className={styles["google-login-error"]} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
