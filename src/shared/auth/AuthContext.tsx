/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect -- provider + hook share a file, and the provider mirrors external Supabase auth state into React */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import {
  supabase,
  SUPABASE_NOT_CONFIGURED_MESSAGE,
} from "@shared/lib/supabase";
import type { Profile } from "@shared/lib/database.types";

export type OAuthProvider = "google" | "apple" | "facebook";

export type AuthResult = { error: AuthError | Error | null };

export type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<AuthResult>;
  updateProfile: (input: {
    firstName: string;
    lastName: string;
  }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const notConfigured = new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);

/**
 * Safe defaults so any component (and the test suite) can render without a
 * mounted provider. `AuthProvider` supplies the real implementation.
 */
const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: false,
  signInWithOAuth: async () => ({ error: null }),
  signInWithPassword: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabase !== null);
  const userId = session?.user.id ?? null;

  // Restore the persisted session and keep it in sync with Supabase.
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  }, [userId]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      async signInWithOAuth(provider) {
        if (!supabase) return { error: notConfigured };
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: "https://quick-tab-payments.vercel.app/" },
        });
        return { error };
      },
      async signInWithPassword(email, password) {
        if (!supabase) return { error: notConfigured };
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error };
      },
      async signUp({ email, password, firstName, lastName }) {
        if (!supabase) return { error: notConfigured };
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        });
        return { error };
      },
      async updateProfile({ firstName, lastName }) {
        if (!supabase || !userId) {
          return {
            error: new Error(
              "You need to be signed in to update your profile.",
            ),
          };
        }
        const { error } = await supabase
          .from("profiles")
          .update({ first_name: firstName, last_name: lastName })
          .eq("id", userId);
        if (!error) await refreshProfile();
        return { error };
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut();
      },
      refreshProfile,
    }),
    [session, profile, loading, userId, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
