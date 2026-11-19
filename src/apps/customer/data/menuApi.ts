/**
 * The customer menu loader now lives in `@shared/data/orderingMenu` so the
 * staff order-entry screen can reuse the exact same query + mapping rules.
 * Re-exported here for the existing customer imports.
 */
export {
  fetchItemModifierGroups,
  fetchOrderingMenu as fetchMenu,
  mapMenu,
  mapModifierGroupsByItem,
  menuItemIds,
  toMenuItem,
} from "@shared/data/orderingMenu"
