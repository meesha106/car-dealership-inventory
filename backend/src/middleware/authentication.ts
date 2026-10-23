import jwt from "jsonwebtoken";
import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";
import type { UserRole } from "../services/auth.service.js";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

const tokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(["USER", "ADMIN"]),
});

function unauthorized(): HttpError {
  return new HttpError(401, "UNAUTHORIZED", "A valid bearer token is required.");
}

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    next(unauthorized());
    return;
  }

  try {
    const decoded = jwt.verify(match[1], env.JWT_SECRET);
    const claims = tokenClaimsSchema.safeParse(decoded);
    if (!claims.success) {
      next(unauthorized());
      return;
    }

    request.auth = { id: claims.data.sub, role: claims.data.role };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(unauthorized());
      return;
    }
    next(error);
  }
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request: Request, _response, next) => {
    if (!request.auth) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(new HttpError(403, "FORBIDDEN", "You do not have permission to access this resource."));
      return;
    }
    next();
  };
}
