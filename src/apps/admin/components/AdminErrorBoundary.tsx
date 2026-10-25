import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@shared/ui/Button"

type AdminErrorBoundaryState = {
  error: Error | null
}

/**
 * Catches render errors in the admin route so a bad row cannot blank the whole
 * application. Query/mutation errors are handled by the data layer instead.
 */
export class AdminErrorBoundary extends Component<
  { children: ReactNode },
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin render error", error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 py-12">
        <div className="w-full max-w-[480px] rounded-card border border-line bg-paper p-8 text-center shadow-card">
          <p className="text-[11px] font-bold tracking-[0.18em] text-berry uppercase">
            Admin workspace
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-2">
            A screen failed to render. Your data has not been changed. Try again,
            or reload the workspace.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </main>
    )
  }
}
