import { Request, Response, NextFunction } from 'express';
import { db } from '../db/client';

export interface AuthedRequest extends Request {
  userId: string;
  orgId: string;
  orgRole: string;
  accessToken: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Resolve organization membership
  const orgIdParam = req.headers['x-organization-id'] as string | undefined;

  let orgId: string;
  let orgRole: string;

  if (orgIdParam) {
    const { data: member } = await db
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('organization_id', orgIdParam)
      .single();

    if (!member) {
      res.status(403).json({ error: 'User is not a member of that organization' });
      return;
    }

    orgId = member.organization_id;
    orgRole = member.role;
  } else {
    // Fall back to first org
    const { data: member } = await db
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!member) {
      res.status(403).json({ error: 'User has no organization' });
      return;
    }

    orgId = member.organization_id;
    orgRole = member.role;
  }

  (req as AuthedRequest).userId = user.id;
  (req as AuthedRequest).orgId = orgId;
  (req as AuthedRequest).orgRole = orgRole;
  (req as AuthedRequest).accessToken = token;

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authed = req as AuthedRequest;
    if (!roles.includes(authed.orgRole)) {
      res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
      return;
    }
    next();
  };
}
