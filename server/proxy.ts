import { Router } from 'express';
import { publicRouter } from './routes/publicRoutes';
import { userOrgRouter } from './routes/userOrgRoutes';
import { itemsRouter } from './routes/itemsRoutes';

export const proxyRouter = Router();

// Mount modular sub-routers
proxyRouter.use(publicRouter);
proxyRouter.use(userOrgRouter);
proxyRouter.use(itemsRouter);

// Re-exports for backward compatibility and internal utilities
export { syncAndPersistFinancialAccountBalances } from './accountingSync';
export {
  TENANT_SCOPED_COLLECTIONS,
  checkRolePermission,
  sanitizePayloadForDirectus,
} from './permissions';
