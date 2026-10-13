/* eslint-disable react-refresh/only-export-components -- route configuration file */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { cn } from "@shared/lib/cn";

const CustomerApp = lazy(() => import("../apps/customer/App"));
const StaffApp = lazy(() => import("../apps/staff/App"));
const AdminApp = lazy(() => import("../apps/admin/App"));

function withSuspense(node: ReactNode) {
  return (
    <Suspense fallback={<div className={cn("min-h-screen", "bg-sand")} />}>
      {node}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<CustomerApp />),
  },
  {
    path: "/staff",
    element: withSuspense(<StaffApp />),
  },
  {
    path: "/admin",
    element: withSuspense(<AdminApp />),
  },
]);

export default router;
