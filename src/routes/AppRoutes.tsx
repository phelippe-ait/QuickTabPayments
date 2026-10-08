import { createBrowserRouter } from "react-router";

import StaffDashboard from "../features/Staff/StaffDashboard";

const router = createBrowserRouter([
  {
    path: "/",
    Component: StaffDashboard,
  },
  //   {
  //     path: "/order/:orderId",
  //     Component: OrderConfirmation,
  //   },
]);

export default router;
