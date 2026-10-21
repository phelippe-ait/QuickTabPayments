/* eslint-disable react-refresh/only-export-components -- route configuration file */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { cn } from "@shared/lib/cn";
import { AdminIndexRedirect } from "../apps/admin/components/AdminIndexRedirect";
import { RequireRole } from "../apps/admin/components/RequireRole";

const CustomerApp = lazy(() => import("../apps/customer/CustomerDashboard"));
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

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className={cn("min-h-screen", "bg-sand")} />}>
      {node}
    </Suspense>
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
    element: withSuspense(<CustomerApp />),
  },
  {
    path: "/staff",
    element: withSuspense(<StaffApp />),
  },
  ...adminRoutes,
]);

export default router;
