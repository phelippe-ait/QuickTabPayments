import { Navigate } from "react-router"

/**
 * `/admin` has no page of its own. The admin app is owner/manager only, so the
 * catalog is always the landing section.
 */
export function AdminIndexRedirect() {
  return <Navigate to="/admin/catalog" replace />
}
