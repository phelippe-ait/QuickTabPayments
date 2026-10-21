import { PageHeader } from "../../components/AdminUi"

/**
 * M1 placeholder. The real settings form (profile + branding) lands in M2.
 */
export function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Restaurant management"
        title="Settings"
        description="Manage your restaurant profile, branding, and service details."
      />
      <section className="mt-6 rounded-card border border-line bg-paper p-8 shadow-card">
        <h2 className="font-serif text-2xl text-ink">Settings are coming next</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-2">
          Profile fields, opening details, and logo/cover uploads will be
          editable here. Nothing on this page is saved yet.
        </p>
      </section>
    </>
  )
}
