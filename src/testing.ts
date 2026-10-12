/**
 * Helpers for an app's tests, imported from `lumen-framework/testing`. They
 * are kept out of the main entry, so they never reach an app's runtime
 * bundle.
 *
 * @module lumen-framework/testing
 */
export { auditVisibility, exposureOf, startApp } from './packages/testing';
export type {
  AuditedDocument,
  AuditedRoute,
  AuditVisibilityOptions,
  ControllerExposure,
  DocumentCheckResult,
  NamespaceExposure,
  StartAppOptions,
  StartedApp,
  TypeExposure,
  VisibilityAudit,
  VisibilityViolation,
  VisibleRecords
} from './packages/testing';
