import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthScreen } from "./AuthScreen";

const signInWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("@shared/auth/AuthContext", () => ({
  useAuth: () => ({
    signInWithOAuth,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    loading: false,
  }),
}));

function renderScreen(kind: "login" | "signup" = "login") {
  render(<AuthScreen kind={kind} onBack={() => {}} onContinue={() => {}} />);
}

describe("AuthScreen", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  });

  it("offers Google as the only social login", () => {
    renderScreen();

    expect(screen.getAllByRole("button", { name: /with Google/i })).toHaveLength(
      1,
    );
    expect(screen.getByRole("button", { name: "Log in with Google" })).toBeEnabled();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.queryByText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByText(/Coming soon/i)).not.toBeInTheDocument();
  });

  it("keeps the Google-only social option on the signup screen", () => {
    renderScreen("signup");

    expect(
      screen.getByRole("button", { name: "Sign up with Google" }),
    ).toBeEnabled();
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.queryByText("Facebook")).not.toBeInTheDocument();
    expect(screen.queryByText(/Coming soon/i)).not.toBeInTheDocument();
  });

  it("starts the Google OAuth flow when the social button is pressed", async () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Log in with Google" }));

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith("google"));
  });
});
