/**
 * Compat shim — the old seed file used to ship with hardcoded sample
 * customers / appointments / leads / tasks / expenses. Those have been removed.
 *
 * New accounts get only starter business config (services, templates,
 * checklists, equipment categories, default availability). See `starter.ts`.
 */
export { EMPTY_DATA as SEED } from "./starter";
