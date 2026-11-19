import { useEffect, useState, type FormEvent } from "react";
import styles from "../../App.module.css";
import { useRestaurant } from "@shared/restaurant/useRestaurant";
import { Button } from "@shared/ui/Button";
import { EmptyState, PageHeader } from "../../components/AdminUi";
import { ImageCropDialog } from "../../components/ImageCropDialog";
import { useAdminUi } from "../../hooks/AdminUiProvider";
import { useRestaurantSettings } from "../../hooks/useRestaurantSettings";
import {
  IMAGE_ACCEPT,
  validateImageSourceFile,
  type RestaurantAssetKind,
} from "@shared/lib/storage";
import { isValidTimezone, percentToTaxRate, taxRateToPercent } from "./settings.utils";
import { findAddressMatches, type AddressMatch } from "./geocodeAddress";

type LocationPoint = AddressMatch & { geofence_enabled: boolean };

const SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";
const SLUG_TITLE = "Lowercase letters, numbers and single hyphens only";

const currencies = [
  "AUD",
  "NZD",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "SGD",
  "JPY",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "ZAR",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "HKD",
  "KRW",
  "MYR",
  "THB",
  "IDR",
  "PHP",
  "VND",
];

type SettingsForm = {
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  timezone: string;
  taxPercent: string;
};

export function SettingsPage() {
  const { restaurant, role } = useRestaurant();
  const { notify, notifyError } = useAdminUi();
  const restaurantId = restaurant?.id ?? "";
  const settings = useRestaurantSettings(restaurantId, {
    onSaved: notify,
    onError: notifyError,
  });
  const source = settings.restaurant ?? restaurant;
  const isOwner = role === "owner";

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [brandingError, setBrandingError] = useState("");
  const [cropRequest, setCropRequest] = useState<{
    kind: RestaurantAssetKind;
    file: File;
  } | null>(null);
  const [taxError, setTaxError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [locationPoint, setLocationPoint] = useState<LocationPoint | null>(null);
  const [addressEdited, setAddressEdited] = useState(false);
  const [addressMatches, setAddressMatches] = useState<AddressMatch[]>([]);
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState("");
  const [clearSavedLocation, setClearSavedLocation] = useState(false);
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceError, setGeofenceError] = useState("");

  useEffect(() => {
    if (settings.isLocationPending) return;
    setLocationPoint(
      settings.location
        ? {
            latitude: settings.location.latitude,
            longitude: settings.location.longitude,
            label: settings.location.label,
            geofence_enabled: settings.location.geofence_enabled,
          }
        : null,
    );
    setGeofenceEnabled(settings.location?.geofence_enabled ?? false);
    setClearSavedLocation(false);
    setAddressEdited(false);
  }, [settings.isLocationPending, settings.location]);
  const [timezoneError, setTimezoneError] = useState("");

  useEffect(() => {
    if (!source) return;
    setForm({
      name: source.name,
      slug: source.slug,
      description: source.description ?? "",
      address: source.address ?? "",
      phone: source.phone ?? "",
      email: source.email ?? "",
      currency: source.currency,
      timezone: source.timezone,
      taxPercent: taxRateToPercent(source.tax_rate),
    });
  }, [source]);

  if (settings.error) {
    return (
      <>
        <PageHeader
          eyebrow="Restaurant management"
          title="Settings"
          description="Manage your restaurant profile, branding, and service details."
        />
        <EmptyState
          title="We couldn't load these settings"
          description={settings.error.message}
        />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={settings.refetch}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  if (!source || !form) {
    return (
      <>
        <PageHeader
          eyebrow="Restaurant management"
          title="Settings"
          description="Manage your restaurant profile, branding, and service details."
        />
        <div className="grid gap-4 py-8" role="status" aria-label="Loading restaurant settings">
          <div className="h-10 w-56 animate-pulse rounded-lg bg-line-soft" />
          <div className="h-64 animate-pulse rounded-card bg-line-soft" />
          <div className="h-64 animate-pulse rounded-card bg-line-soft" />
        </div>
      </>
    );
  }

  const update = (patch: Partial<SettingsForm>) =>
    setForm((current) => (current ? { ...current, ...patch } : current));

  const handleUpload = (kind: RestaurantAssetKind, file: File | undefined) => {
    if (!file) return;
    try {
      validateImageSourceFile(file);
    } catch (error) {
      setBrandingError(
        error instanceof Error ? error.message : "Choose another image.",
      );
      return;
    }
    setBrandingError("");
    setCropRequest({ kind, file });
  };

  const removeSavedLocation = () => {
    setLocationPoint(null);
    setClearSavedLocation(true);
    setGeofenceEnabled(false);
    setGeofenceError("");
    setAddressEdited(false);
  };

  const lookupAddress = async () => {
    if (!form.address.trim()) {
      setAddressLookupError("Enter the restaurant street address first.");
      return;
    }
    setIsLookingUpAddress(true);
    setAddressLookupError("");
    setAddressMatches([]);
    try {
      const matches = await findAddressMatches(form.address);
      setAddressMatches(matches);
      if (matches.length === 0) {
        setAddressLookupError(
          "No matching address found. Add more detail and try again.",
        );
      }
    } catch (error) {
      setAddressLookupError(
        error instanceof Error
          ? error.message
          : "Address lookup is temporarily unavailable.",
      );
    } finally {
      setIsLookingUpAddress(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTaxError("");
    setTimezoneError("");
    setSlugError("");

    const taxRate = percentToTaxRate(form.taxPercent);
    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 1) {
      setTaxError("Enter a tax rate between 0 and 100.");
      return;
    }

    const timezone = form.timezone.trim() || "Australia/Sydney";
    if (!isValidTimezone(timezone)) {
      setTimezoneError("Enter a valid IANA timezone, e.g. Australia/Sydney.");
      return;
    }

    if (!form.name.trim()) return;

    const slug = form.slug.trim();
    const slugChanged = isOwner && slug !== source.slug;
    if (slugChanged && !new RegExp(`^${SLUG_PATTERN}$`).test(slug)) {
      setSlugError(SLUG_TITLE);
      return;
    }

    if (geofenceEnabled && !locationPoint) {
      setGeofenceError("Find and select the restaurant address before enabling the 500 m check.");
      return;
    }

    settings.save({
      name: form.name.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      currency: form.currency.trim() || "AUD",
      timezone: timezone,
      tax_rate: taxRate,
      ...(slugChanged ? { slug } : {}),
    }, locationPoint
      ? {
          latitude: locationPoint.latitude,
          longitude: locationPoint.longitude,
          label: locationPoint.label,
          geofence_enabled: geofenceEnabled,
        }
      : clearSavedLocation
        ? null
        : undefined);
  };

  return (
    <>
      <PageHeader
        eyebrow="Restaurant management"
        title="Settings"
        description="Manage your restaurant profile, branding, and service details."
      />

      <form className="mt-6 grid gap-6" onSubmit={submit}>
        <section className="rounded-card border border-line bg-paper p-7 shadow-card">
          <h2 className="font-serif text-2xl text-ink">Profile</h2>
          <p className="mt-1 text-xs text-muted">
            This information is shown to guests in the customer app.
          </p>
          <div className={`${styles["form-grid"]} mt-5`}>
            <label className={styles["wide"]}>
              Restaurant name
              <input
                required
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="QuickTab Demo Café"
              />
            </label>
            <label className={styles["wide"]}>
              Web address
              <input
                required
                value={form.slug}
                onChange={(event) => {
                  update({ slug: event.target.value });
                  setSlugError("");
                }}
                pattern={SLUG_PATTERN}
                title={SLUG_TITLE}
                readOnly={!isOwner}
                disabled={!isOwner}
                aria-invalid={Boolean(slugError)}
                aria-describedby={
                  slugError ? "settings-slug-hint settings-slug-error" : "settings-slug-hint"
                }
              />
              {slugError && (
                <small
                  className={`${styles["field-error"]}`}
                  id="settings-slug-error"
                  role="alert"
                >
                  {slugError}
                </small>
              )}
              <small
                className="mt-1.5 block text-[10px] font-normal text-muted"
                id="settings-slug-hint"
              >
                {isOwner
                  ? "Changing this breaks QR links printed with the old address."
                  : "Only the restaurant owner can change the web address."}
              </small>
            </label>
            <label className={styles["wide"]}>
              Description
              <textarea
                value={form.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
                placeholder="A short description of your café"
              />
            </label>
            <div className={styles["wide"]}>
              <label htmlFor="settings-address">Street address</label>
              <input
                id="settings-address"
                value={form.address}
                onChange={(event) => {
                  update({ address: event.target.value });
                  setAddressEdited(true);
                  setAddressMatches([]);
                  setAddressLookupError("");
                }}
                placeholder="12 Harbour Lane, Sydney NSW"
                aria-describedby="settings-location-hint"
              />
              <small
                className="mt-1.5 block text-[10px] font-normal text-muted"
                id="settings-location-hint"
              >
                Find and confirm the matching map point to use it for the 500 m
                ordering area. Guest orders work with or without it.
              </small>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void lookupAddress()}
                  disabled={isLookingUpAddress || !form.address.trim()}
                >
                  {isLookingUpAddress ? "Finding address…" : "Find address"}
                </Button>
                {locationPoint && (
                  <span className="text-xs text-ink-mid" role="status">
                    Location selected
                  </span>
                )}
                {settings.location &&
                  !settings.isLocationPending &&
                  !clearSavedLocation && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={removeSavedLocation}
                    >
                      Remove saved location
                    </Button>
                  )}
                {clearSavedLocation && (
                  <span className="text-xs font-medium text-danger" role="status">
                    Saved location will be removed when you save.
                  </span>
                )}
              </div>
              {locationPoint && (
                <div className="mt-2">
                  <p className="text-xs text-ink-mid" role="status">
                    {locationPoint.label}
                  </p>
                  <small className="mt-1 block text-[10px] text-muted">
                    Address data © OpenStreetMap contributors
                  </small>
                </div>
              )}
              {addressEdited && locationPoint && (
                <p
                  className="mt-2 rounded-lg bg-sand px-3 py-2 text-[10px] leading-relaxed text-ink-mid"
                  role="status"
                >
                  The street address changed after this map point was chosen.
                  Use <strong>Find address</strong> again so the 500 m area
                  follows the new address — otherwise the saved point stays
                  where it is.
                </p>
              )}
              {addressLookupError && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {addressLookupError}
                </p>
              )}
              {addressMatches.length > 0 && (
                <div className="mt-3 grid gap-2" aria-label="Address matches">
                  {addressMatches.map((match) => (
                    <button
                      key={`${match.latitude},${match.longitude}`}
                      type="button"
                      className="rounded-lg border border-line bg-white px-3 py-2 text-left text-xs text-ink-mid hover:bg-sand"
                      onClick={() => {
                        setLocationPoint({
                          ...match,
                          geofence_enabled: geofenceEnabled,
                        });
                        setClearSavedLocation(false);
                        setAddressEdited(false);
                        setAddressMatches([]);
                        setAddressLookupError("");
                      }}
                    >
                      {match.label}
                    </button>
                  ))}
                </div>
              )}
              {!locationPoint && !settings.isLocationPending && (
                <small className="mt-2 block text-[10px] font-normal text-muted">
                  No map point saved yet. Find the address to enable the 500 m
                  ordering area.
                </small>
              )}
              {settings.locationError && (
                <small className="mt-2 block text-[10px] text-danger" role="alert">
                  Could not load the saved restaurant location: {settings.locationError.message}
                </small>
              )}
              <label className="mt-4 flex items-start gap-2 text-xs font-medium text-ink-mid">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={geofenceEnabled}
                  disabled={!locationPoint}
                  onChange={(event) => {
                    setGeofenceEnabled(event.target.checked);
                    setGeofenceError("");
                  }}
                />
                <span>
                  Enforce the 500 m ordering area
                  <small className="mt-1 block text-[10px] font-normal text-muted">
                    Off by default. When on, guests must share their location and
                    be within 500 m of this map point to order.
                  </small>
                </span>
              </label>
              {geofenceError && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {geofenceError}
                </p>
              )}
            </div>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(event) => update({ phone: event.target.value })}
                placeholder="+61 2 9000 0000"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => update({ email: event.target.value })}
                placeholder="hello@quicktab.demo"
              />
            </label>
          </div>
        </section>

        <section className="rounded-card border border-line bg-paper p-7 shadow-card">
          <h2 className="font-serif text-2xl text-ink">Service</h2>
          <p className="mt-1 text-xs text-muted">
            Currency, timezone, and tax drive every price and report.
          </p>
          <div className={`${styles["form-grid"]} mt-5`}>
            <label>
              Currency
              <select
                value={form.currency}
                onChange={(event) => update({ currency: event.target.value })}
              >
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>
            <label>
              Timezone
              <input
                required
                value={form.timezone}
                aria-invalid={Boolean(timezoneError)}
                aria-describedby={timezoneError ? "settings-timezone-error" : undefined}
                onChange={(event) => update({ timezone: event.target.value })}
                placeholder="Australia/Sydney"
              />
              {timezoneError && (
                <small className={`${styles["field-error"]}`} id="settings-timezone-error" role="alert">
                  {timezoneError}
                </small>
              )}
            </label>
            <label>
              Tax rate (%)
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={form.taxPercent}
                aria-invalid={Boolean(taxError)}
                aria-describedby={taxError ? "settings-tax-error" : undefined}
                onChange={(event) => {
                  update({ taxPercent: event.target.value });
                  setTaxError("");
                }}
              />
              {taxError && (
                <small
                  className={styles["field-error"]}
                  id="settings-tax-error"
                  role="alert"
                >
                  {taxError}
                </small>
              )}
            </label>
          </div>
        </section>

        <section className="rounded-card border border-line bg-paper p-7 shadow-card">
          <h2 className="font-serif text-2xl text-ink">Branding</h2>
          <p className="mt-1 text-xs text-muted">
            Any photo works — you&apos;ll crop it before upload. JPG, PNG, or
            WebP up to 20 MB; the stored image is resized automatically.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <BrandingField
              label="Logo"
              description="Square image for your restaurant branding."
              variant="logo"
              imageUrl={source.logo_url}
              alt="Current restaurant logo"
              accept={IMAGE_ACCEPT}
              disabled={settings.isUploading}
              onFile={(file) => handleUpload("logo", file)}
            />
            <BrandingField
              label="Cover image"
              description="Wide 16:9 image for your restaurant branding."
              variant="cover"
              imageUrl={source.cover_image_url}
              alt="Current restaurant cover"
              accept={IMAGE_ACCEPT}
              disabled={settings.isUploading}
              onFile={(file) => handleUpload("cover", file)}
            />
          </div>

          {(brandingError || settings.uploadError) && (
            <p className="mt-4 text-[12px] text-danger" role="alert">
              {brandingError || settings.uploadError?.message}
            </p>
          )}
          {settings.isUploading && (
            <p className="mt-3 text-xs text-muted" role="status">
              Uploading image…
            </p>
          )}
        </section>

        <div className={`${styles["modal-actions"]}`}>
          {settings.saveError && (
            <p className="mr-auto text-[12px] text-danger" role="alert">
              {settings.saveError.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={settings.isSaving || settings.isLocationPending}
          >
            {settings.isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      {cropRequest && (
        <ImageCropDialog
          file={cropRequest.file}
          title={cropRequest.kind === "logo" ? "Crop logo" : "Crop cover image"}
          aspect={cropRequest.kind === "logo" ? 1 : 16 / 9}
          outputWidth={cropRequest.kind === "logo" ? 512 : 1600}
          onCancel={() => setCropRequest(null)}
          onConfirm={(cropped) => {
            settings.uploadBranding(cropRequest.kind, cropped);
            setCropRequest(null);
          }}
        />
      )}
    </>
  );
}

function BrandingField({
  label,
  description,
  imageUrl,
  alt,
  accept,
  disabled,
  variant,
  onFile,
}: {
  label: string;
  description: string;
  imageUrl: string | null;
  alt: string;
  accept: string;
  disabled: boolean;
  variant: "logo" | "cover";
  onFile: (file: File | undefined) => void;
}) {
  const isCover = variant === "cover";

  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <div
        className={
          isCover
            ? "grid gap-4"
            : "grid grid-cols-[96px_1fr] items-center gap-4 max-[480px]:grid-cols-1"
        }
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className={
              isCover
                ? "aspect-video w-full rounded-lg bg-sand object-cover"
                : "h-24 w-24 rounded-lg bg-sand object-cover"
            }
          />
        ) : (
          <span
            className={
              isCover
                ? "grid aspect-video w-full place-items-center rounded-lg border border-dashed border-line bg-cream-2 text-center text-[10px] font-bold text-muted"
                : "grid h-24 w-24 place-items-center rounded-lg border border-dashed border-line bg-cream-2 text-center text-[10px] font-bold text-muted"
            }
            aria-hidden="true"
          >
            No image
          </span>
        )}
        <div className="min-w-0">
          <strong className="block text-[12px] text-ink-soft">{label}</strong>
          <small className="mb-3 block text-[10px] leading-[1.5] text-muted">
            {description}
          </small>
          <label className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-cream-3 px-3 text-[11px] font-bold text-ink-mid transition-colors hover:border-berry hover:text-berry">
            {imageUrl ? "Replace" : "Upload"}
            <input
              className="sr-only"
              type="file"
              accept={accept}
              aria-label={`${imageUrl ? "Replace" : "Upload"} ${label.toLowerCase()}`}
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                onFile(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
