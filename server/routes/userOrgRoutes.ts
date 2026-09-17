import { Router, Response } from 'express';
import { DirectusAdminClient } from '../directusAdmin';
import { requireAuth, AuthenticatedRequest, getUserOrganizations } from '../auth';

export const userOrgRouter = Router();

// Profile / Current user endpoints (available at both /api/users/me and /api/auth/me)
const handleMeRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, organizationId } = req.user!;
    const user = await DirectusAdminClient.request(`/users/${userId}`).catch(() => null);
    const { activeOrganization, organizations } = await getUserOrganizations(
      userId,
      organizationId
    );

    return res.json({
      id: user?.id || userId,
      email: user?.email || req.user!.email,
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      avatar: user?.avatar || null,
      title: user?.title || null,
      status: user?.status || 'active',
      role: req.user!.role || activeOrganization?.user_role || 'owner',
      active_organization_id: activeOrganization?.id || organizationId,
      active_organization: activeOrganization,
      activeOrganization: activeOrganization,
      organizations: organizations,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
  }
};

userOrgRouter.get('/users/me', requireAuth, handleMeRequest);
userOrgRouter.get('/auth/me', requireAuth, handleMeRequest);

// Organization Switcher & Access endpoints
userOrgRouter.get(
  '/organizations',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, organizationId } = req.user!;
      const { organizations } = await getUserOrganizations(userId, organizationId);
      return res.json(organizations);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to fetch organizations' });
    }
  }
);

userOrgRouter.get(
  '/organizations/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.user!;
      const orgId = Number(req.params.id);

      // Verify user belongs to this org
      const memberships = await DirectusAdminClient.getItems('organization_users', {
        filter: {
          _and: [
            { user_id: { _eq: userId } },
            { organization_id: { _eq: orgId } },
          ],
        },
        limit: 1,
      });

      if (memberships.length === 0) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }

      const org = await DirectusAdminClient.getItemById('organizations', orgId);
      return res.json(org);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to fetch organization' });
    }
  }
);
