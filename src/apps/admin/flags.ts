/**
 * Admin feature flags.
 *
 * Keep this module free of React and `import.meta.env` so flags can be
 * imported anywhere (including tests) without side effects.
 */

/**
 * Refund actions use the real Stripe refund API (`POST /api/refunds`).
 * The schema, read-only refund history and the record-a-refund UI all ship
 * (see M6); flip this to `false` only if the server endpoint is unavailable.
 */
export const REFUNDS_ENABLED = true;
