/**
 * Admin feature flags.
 *
 * Keep this module free of React and `import.meta.env` so flags can be
 * imported anywhere (including tests) without side effects.
 */

/**
 * Refund actions are hidden until the Stripe refund call is wired. The schema
 * and read-only refund history still ship (see M6); flipping this to `true`
 * only reveals the record-a-refund UI.
 */
export const REFUNDS_ENABLED = false;
