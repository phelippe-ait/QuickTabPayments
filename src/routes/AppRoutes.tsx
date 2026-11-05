/* eslint-disable react-refresh/only-export-components -- route configuration file */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { AdminIndexRedirect } from "../apps/admin/components/AdminIndexRedirect";
import { RequireRole } from "../apps/admin/components/RequireRole";

const CustomerApp = lazy(() => import("../apps/customer/CustomerDashboard"));
const ProspectHome = lazy(() => import("../apps/marketing/ProspectHome"));
const OrderTrackingPage = lazy(() =>
  import("../apps/customer/features/orders/OrderTrackingScreen").then(
    (module) => ({
      default: module.OrderTrackingScreen,
    }),
  ),
);
const StaffApp = lazy(() => import("../apps/staff/StaffDashboard"));
const AdminApp = lazy(() => import("../apps/admin/AdminDashboard"));

const AdminCatalogPage = lazy(() =>
  import("../apps/admin/features/catalog/CatalogPage").then((module) => ({
    default: module.CatalogPage,
  })),
);
const AdminTablesPage = lazy(() =>
  import("../apps/admin/features/tables/TablesPage").then((module) => ({
    default: module.TablesPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("../apps/admin/features/users/UsersPage").then((module) => ({
    default: module.UsersPage,
  })),
);
const AdminOrdersPage = lazy(() =>
  import("../apps/admin/features/orders/OrdersPage").then((module) => ({
    default: module.OrdersPage,
  })),
);
const AdminSettingsPage = lazy(() =>
  import("../apps/admin/features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const AdminOrderDetailPage = lazy(() =>
  import("../apps/admin/features/orders/OrderDetailPage").then((module) => ({
    default: module.OrderDetailPage,
  })),
);

function withSuspense(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-sand p-8"
          role="status"
          aria-label="Loading page"
        >
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="h-10 w-56 animate-pulse rounded-lg bg-line-soft" />
            <div className="h-48 w-full animate-pulse rounded-card bg-line-soft" />
            <div className="h-48 w-full animate-pulse rounded-card bg-line-soft" />
          </div>
        </div>
      }
    >
      {node}
    </Suspense>
  );
}

function HomeRoute() {
  const hasQrParams =
    new URLSearchParams(window.location.search).has("r") ||
    new URLSearchParams(window.location.search).has("t");
  let hasStoredQr = false;
  try {
    const stored = window.sessionStorage.getItem("quicktab:qr-source");
    if (stored) {
      const source: unknown = JSON.parse(stored);
      if (source && typeof source === "object") {
        const record = source as Record<string, unknown>;
        hasStoredQr =
          typeof record.slug === "string" &&
          typeof record.tableToken === "string";
      }
    }
  } catch {
    // Storage can be unavailable in private browsing; URL params still work.
  }

  return hasQrParams || hasStoredQr || import.meta.env.VITE_RESTAURANT_SLUG ? (
    <CustomerApp />
  ) : (
    <ProspectHome />
  );
}

const ownerOrManager = ["owner", "manager"] as const;
const anyStaff = ["owner", "manager", "kitchen"] as const;

/**
 * Admin route tree. Exported so tests can build a memory router from the same
 * configuration the app ships.
 */
export const adminRoutes: RouteObject[] = [
  {
    path: "/admin",
    element: withSuspense(<AdminApp />),
    children: [
      { index: true, element: <AdminIndexRedirect /> },
      {
        path: "catalog",
        element: withSuspense(
          <RequireRole roles={[...ownerOrManager]}>
            <AdminCatalogPage />
          </RequireRole>,
        ),
      },
      {
        path: "tables",
        element: withSuspense(
          <RequireRole roles={[...ownerOrManager]}>
            <AdminTablesPage />
          </RequireRole>,
        ),
      },
      {
        path: "users",
        element: withSuspense(
          <RequireRole roles={[...ownerOrManager]}>
            <AdminUsersPage />
          </RequireRole>,
        ),
      },
      {
        path: "orders",
        element: withSuspense(
          <RequireRole roles={[...anyStaff]}>
            <AdminOrdersPage />
          </RequireRole>,
        ),
      },
      {
        path: "orders/:id",
        element: withSuspense(
          <RequireRole roles={[...anyStaff]}>
            <AdminOrderDetailPage />
          </RequireRole>,
        ),
      },
      {
        path: "settings",
        element: withSuspense(
          <RequireRole roles={[...ownerOrManager]}>
            <AdminSettingsPage />
          </RequireRole>,
        ),
      },
    ],
  },
];

const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<HomeRoute />),
  },
  {
    path: "/staff",
    element: withSuspense(<StaffApp />),
  },
  {
    // Public guest tracking link; authorised by the opaque `token` query param.
    path: "/order/:orderNumber",
    element: withSuspense(<OrderTrackingPage />),
  },
  ...adminRoutes,
]);

export default router;
