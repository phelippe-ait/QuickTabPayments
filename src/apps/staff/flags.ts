/**
 * Staff feature flags.
 *
 * Keep this module free of React and `import.meta.env` so flags can be imported
 * anywhere (including tests) without side effects.
 */

/**
 * Reservations have no backing table yet (fixture-only). Hidden until built.
 * Decision D1.
 */
export const RESERVATIONS_ENABLED = false;
