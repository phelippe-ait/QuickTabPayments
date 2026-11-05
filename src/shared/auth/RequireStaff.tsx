import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@shared/auth/AuthContext";
import { useRestaurant } from "@shared/restaurant/useRestaurant";
import {
  claimRestaurantInvite,
  fetchMyRestaurantInvite,
  inviteKeys,
  type RestaurantInvite,
} from "@shared/data/invites";
import {
  isSupabaseConfigured,
  SUPABASE_NOT_CONFIGURED_MESSAGE,
} from "@shared/lib/supabase";
import { Button } from "@shared/ui/Button";

type StaffGateVariant = "admin" | "staff";

/**
 * Blocks a workspace until we know the user is an active staff member of a
 * restaurant. Signed-out users get the login screen, signed-in non-staff get a
 * clear "no access" state with a sign-out escape hatch.
 *
 * Shared by the admin (`/admin`) and staff (`/staff`) apps; only the copy and
 * OAuth redirect path differ.
 */
export function RequireStaff({
  children,
  variant = "admin",
  redirectTo,
}: {
  children: ReactNode;
  variant?: StaffGateVariant;
  /** Path the OAuth provider returns to. Defaults to the variant's app path. */
  redirectTo?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading, error, membership, refetch } = useRestaurant();
  const isStaff = variant === "staff";

  if (!isSupabaseConfigured) {
    return (
      <GateMessage
        title="Supabase is not configured"
        body={SUPABASE_NOT_CONFIGURED_MESSAGE}
      />
    );
  }

  if (authLoading) return <GateLoading label="Checking your session…" />;
  if (!user) return <LoginScreen variant={variant} redirectTo={redirectTo} />;
  if (isLoading) return <GateLoading label="Loading your restaurant…" />;

  if (error) {
    return (
      <GateMessage
        title="We couldn't load your restaurant"
        body={error.message}
        action={
          <Button onClick={refetch} variant="secondary">
            Try again
          </Button>
        }
      />
    );
  }

  if (!membership) {
    // Staff accounts are added by an owner; they cannot claim an invitation
    // from the workspace sign-in screen.
    return isStaff ? <StaffNoAccess /> : <NoAccess />;
  }

  return <>{children}</>;
}

function LoginScreen({
  variant,
  redirectTo,
}: {
  variant: StaffGateVariant;
  redirectTo?: string;
}) {
  const { signInWithPassword, signInWithOAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isStaff = variant === "staff";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);
    const { error: signInError } = await signInWithPassword(email, password);
    if (signInError) {
      setError(signInError.message);
      setPending(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setPending(true);
    const path = redirectTo ?? (isStaff ? "/staff" : "/admin");
    const { error: oauthError } = await signInWithOAuth("google", {
      redirectTo: `${window.location.origin}${path}`,
    });
    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-12">
      <div className="w-full max-w-[400px] rounded-card border border-line bg-paper p-8 shadow-card">
        <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
          QuickTab
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.02em] text-ink">
          {isStaff ? "Staff sign in" : "Manager sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-2">
          {isStaff
            ? "Use the account your restaurant added to the team."
            : "Use the account linked to your restaurant."}
        </p>

        <Button
          className="mt-6"
          fullWidth
          variant="secondary"
          onClick={handleGoogle}
          disabled={pending}
        >
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-[11px] font-bold tracking-wide text-muted uppercase">
          <span className="h-px flex-1 bg-line" />
          or email
          <span className="h-px flex-1 bg-line" />
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-[12px] font-bold text-ink-soft">
            Email
            <input
              className="h-[42px] rounded-[9px] border border-line bg-white px-3 text-[13px] font-normal text-ink outline-none focus:border-berry"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold text-ink-soft">
            Password
            <input
              className="h-[42px] rounded-[9px] border border-line bg-white px-3 text-[13px] font-normal text-ink outline-none focus:border-berry"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function StaffNoAccess() {
  const { user, signOut } = useAuth();
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-12">
      <div className="w-full max-w-[480px] rounded-card border border-line bg-paper p-8 text-center shadow-card">
        <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
          QuickTab
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.02em] text-ink">
          No workspace access
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-2">
          {user?.email || "This account"} isn&apos;t on a restaurant team yet.
          Ask an owner or manager to add you before signing in here.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

function NoAccess() {
  const { user, signOut } = useAuth();
  const { refetch } = useRestaurant();
  const inviteQuery = useQuery({
    queryKey: inviteKeys.my(user?.id ?? "anonymous"),
    queryFn: fetchMyRestaurantInvite,
    enabled: Boolean(user),
  });

  if (inviteQuery.isPending) {
    return <GateLoading label="Checking for your restaurant invitation…" />;
  }

  if (inviteQuery.error) {
    return (
      <GateMessage
        title="We couldn't check your invitation"
        body={inviteQuery.error.message}
        action={
          <Button variant="secondary" onClick={() => void inviteQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (inviteQuery.data) {
    return (
      <ClaimInvite
        key={inviteQuery.data.id}
        invite={inviteQuery.data}
        onClaimed={refetch}
      />
    );
  }

  return (
    <NoInvite
      email={user?.email ?? ""}
      onCheckAgain={() => {
        void inviteQuery.refetch();
        refetch();
      }}
      onSignOut={() => void signOut()}
    />
  );
}

function ClaimInvite({
  invite,
  onClaimed,
}: {
  invite: RestaurantInvite;
  onClaimed: () => void;
}) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(invite.restaurant_name);
  const [slug, setSlug] = useState(invite.restaurant_slug);

  const claim = useMutation({
    mutationFn: () => claimRestaurantInvite({ name, slug }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      onClaimed();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    claim.mutate();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-12">
      <div className="w-full max-w-[480px] rounded-card border border-line bg-paper p-8 shadow-card">
        <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
          Invitation
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.02em] text-ink">
          You&apos;ve been invited
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-2">
          QuickTab prepared a workspace for{" "}
          <strong>{invite.restaurant_name}</strong> for {invite.email}. Review the
          details and create the restaurant.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1.5 text-[12px] font-bold text-ink-soft">
            Restaurant name
            <input
              className="h-[42px] rounded-[9px] border border-line bg-white px-3 text-[13px] font-normal text-ink outline-none focus:border-berry"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold text-ink-soft">
            Web address
            <span className="flex items-center overflow-hidden rounded-[9px] border border-line bg-white focus-within:border-berry">
              <span className="border-r border-line px-3 py-3 text-[12px] font-normal text-muted">
                quicktab.app/
              </span>
              <input
                className="h-[42px] min-w-0 flex-1 px-3 text-[13px] font-normal text-ink outline-none"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Lowercase letters, numbers and single hyphens only"
                maxLength={60}
                required
              />
            </span>
            <small className="text-[10px] font-normal text-muted">
              Used in table QR links. You can adjust it before creating.
            </small>
          </label>
          {claim.error && (
            <p className="text-[12px] text-danger" role="alert">
              {claim.error.message}
            </p>
          )}
          <Button type="submit" fullWidth disabled={claim.isPending}>
            {claim.isPending ? "Creating restaurant…" : "Create my restaurant"}
          </Button>
        </form>

        <div className="mt-6 border-t border-line pt-5 text-center">
          <p className="text-[12px] text-muted-2">Not your account?</p>
          <div className="mt-3 flex justify-center gap-3">
            <Button size="sm" variant="outline" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function NoInvite({
  email,
  onCheckAgain,
  onSignOut,
}: {
  email: string;
  onCheckAgain: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-12">
      <div className="w-full max-w-[480px] rounded-card border border-line bg-paper p-8 text-center shadow-card">
        <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
          QuickTab
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-[-0.02em] text-ink">
          No restaurant linked
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-2">
          {email || "This account"} doesn&apos;t have a restaurant invitation yet.
          Ask QuickTab to set up your restaurant for this email, or ask an owner
          to add you to their team.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={onCheckAgain}>
            Check again
          </Button>
          <Button variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function GateLoading({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream">
      <div className="flex flex-col items-center gap-4 text-sm text-muted-2">
        <span
          className="size-8 animate-spin rounded-full border-2 border-line border-t-berry"
          aria-hidden="true"
        />
        <p role="status">{label}</p>
      </div>
    </main>
  );
}

function GateMessage({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5">
      <div className="w-full max-w-[460px] rounded-card border border-line bg-paper p-8 text-center shadow-card">
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-2">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </main>
  );
}
