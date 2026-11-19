import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";

const mocks = vi.hoisted(() => ({
  role: "owner" as "owner" | "manager" | "kitchen",
  save: vi.fn(),
  uploadBranding: vi.fn(),
  notify: vi.fn(),
  refetch: vi.fn(),
  saveError: null as Error | null,
  findAddressMatches: vi.fn(),
  location: null as {
    latitude: number;
    longitude: number;
    label: string;
    geofence_enabled: boolean;
  } | null,
  restaurant: {
    id: "restaurant-1",
    name: "Test Café",
    slug: "test-cafe",
    description: "A test café",
    address: "1 Test Lane",
    phone: "+61 2 9000 0000",
    email: "hello@test.cafe",
    currency: "AUD",
    timezone: "Australia/Sydney",
    tax_rate: 0.1,
    logo_url: null as string | null,
    cover_image_url: null as string | null,
  },
}));

vi.mock("@shared/restaurant/useRestaurant", () => ({
  useRestaurant: () => ({
    restaurant: mocks.restaurant,
    role: mocks.role,
  }),
}));

vi.mock("../../hooks/AdminUiProvider", () => ({
  useAdminUi: () => ({ notify: mocks.notify, notifyError: vi.fn(), confirm: vi.fn() }),
}));

vi.mock("../../hooks/useRestaurantSettings", () => ({
  useRestaurantSettings: () => ({
    restaurant: mocks.restaurant,
    isPending: false,
    error: null,
    refetch: mocks.refetch,
    save: mocks.save,
    uploadBranding: mocks.uploadBranding,
    isSaving: false,
    isUploading: false,
    saveError: mocks.saveError,
    uploadError: null,
    location: mocks.location,
    isLocationPending: false,
    locationError: null,
  }),
}));

vi.mock("./geocodeAddress", () => ({
  findAddressMatches: mocks.findAddressMatches,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    mocks.role = "owner";
    mocks.save.mockClear();
    mocks.uploadBranding.mockClear();
    mocks.notify.mockClear();
    mocks.saveError = null;
    mocks.location = null;
    mocks.findAddressMatches.mockReset();
    mocks.restaurant.logo_url = null;
    mocks.restaurant.cover_image_url = null;
  });

  it("renders the current restaurant values", () => {
    render(<SettingsPage />);

    expect(screen.getByLabelText(/restaurant name/i)).toHaveValue("Test Café");
    expect(screen.getByLabelText(/tax rate/i)).toHaveValue(10);
    expect(screen.getByLabelText(/^currency$/i)).toHaveValue("AUD");
  });

  it("saves the profile with the tax rate converted to a fraction", () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText(/restaurant name/i), {
      target: { value: "Renamed Café" },
    });
    fireEvent.change(screen.getByLabelText(/tax rate/i), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Renamed Café",
        tax_rate: 0.125,
      }),
      undefined,
    );
  });

  it("keeps the slug read-only for managers", () => {
    mocks.role = "manager";
    render(<SettingsPage />);

    expect(screen.getByLabelText(/web address/i)).toBeDisabled();
    expect(
      screen.getByText(/only the restaurant owner can change/i),
    ).toBeInTheDocument();
  });

  it("shows a validation error instead of saving an invalid tax rate", () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText(/tax rate/i), {
      target: { value: "150" },
    });
    // Submit the form directly to bypass native min/max validation, proving the
    // JS guard also rejects the value.
    fireEvent.submit(
      screen.getByRole("button", { name: /save changes/i }).closest("form")!,
    );

    expect(
      screen.getByText(/enter a tax rate between 0 and 100/i),
    ).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("surfaces a save error from the server", () => {
    mocks.saveError = new Error("permission denied");
    render(<SettingsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });

  it("keeps the saved location when the address text changes", () => {
    mocks.location = {
      latitude: -33.86,
      longitude: 151.2,
      label: "1 Test Lane, Sydney",
      geofence_enabled: true,
    };
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText(/12 Harbour Lane/i), {
      target: { value: "2 Other Street" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1]).toEqual({
      latitude: -33.86,
      longitude: 151.2,
      label: "1 Test Lane, Sydney",
      geofence_enabled: true,
    });
  });

  it("removes the saved location only through the explicit action", () => {
    mocks.location = {
      latitude: -33.86,
      longitude: 151.2,
      label: "1 Test Lane, Sydney",
      geofence_enabled: true,
    };
    render(<SettingsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /remove saved location/i }),
    );
    expect(
      screen.getByText(/will be removed when you save/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mocks.save.mock.calls[0][1]).toBeNull();
  });

  it("saves the location chosen from geocode matches", async () => {
    const match = {
      latitude: -33.9,
      longitude: 151.3,
      label: "2 Other Street, Sydney",
    };
    mocks.findAddressMatches.mockResolvedValue([match]);
    render(<SettingsPage />);

    fireEvent.change(screen.getByPlaceholderText(/12 Harbour Lane/i), {
      target: { value: "2 Other Street" },
    });
    fireEvent.click(screen.getByRole("button", { name: /find address/i }));
    fireEvent.click(await screen.findByRole("button", { name: match.label }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mocks.save.mock.calls[0][1]).toEqual({
      ...match,
      geofence_enabled: false,
    });
  });
});
