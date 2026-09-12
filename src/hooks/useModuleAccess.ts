/**
 * Re-export useModuleAccess and types from ModuleAccessContext
 * Provides a single shared source of truth across all components.
 */

export { useModuleAccess } from '../context/ModuleAccessContext';
export type { ModuleAccessContextType as UseModuleAccessReturn } from '../context/ModuleAccessContext';
