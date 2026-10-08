import { createBrowserRouter } from "react-router";

import StaffDashboard from "../features/Staff/StaffDashboard";
import App from "../app/App";

const router = createBrowserRouter([
  {
    path: "/",
    Component: App,
  },
  {
    path: "/staff",
    Component: StaffDashboard,
  },
  //   {
  //     path: "/order/:orderId",
  //     Component: OrderConfirmation,
  //   },
]);

export default router;
