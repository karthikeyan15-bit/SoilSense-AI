import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

let cachedSecrets: { access: string; refresh: string } | null = null;

function resolveJwtSecrets(): { access: string; refresh: string } {
  if (cachedSecrets) return cachedSecrets;

  const explicit = process.env.JWT_SECRET?.trim();
  if (explicit && explicit !== 'replace-with-strong-random-secret') {
    const refresh =
      process.env.JWT_REFRESH_SECRET?.trim() ||
      crypto.createHmac('sha256', explicit).update('soilsense:jwt:refresh:v1').digest('hex');
    cachedSecrets = { access: explicit, refresh };
    return cachedSecrets;
  }

  // Deterministic server-side derivation so Vercel serverless instances share the exact same
  // cryptographic signing key across cold starts without requiring a manual JWT_SECRET env var.
  const runtimeSeed =
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? process.env.GEMINI_API_KEY
      : '') ||
    process.env.NVIDIA_API_KEY ||
    process.env.VERCEL_PROJECT_ID ||
    '';

  if (runtimeSeed) {
    cachedSecrets = {
      access: crypto.createHmac('sha256', runtimeSeed).update('soilsense:jwt:access:v1').digest('hex'),
      refresh: crypto.createHmac('sha256', runtimeSeed).update('soilsense:jwt:refresh:v1').digest('hex'),
    };
    return cachedSecrets;
  }

  // Local / Render fallback when no API keys are set: auto-generate and persist a 48-byte random secret.
  let generated = '';
  try {
    const secretDir =
      process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME
        ? '/tmp'
        : path.resolve(process.cwd(), 'data', 'processed');
    if (!fs.existsSync(secretDir)) {
      fs.mkdirSync(secretDir, { recursive: true });
    }
    const secretFile = path.join(secretDir, '.jwt_secret');
    if (fs.existsSync(secretFile)) {
      generated = fs.readFileSync(secretFile, 'utf-8').trim();
    }
    if (!generated) {
      generated = crypto.randomBytes(48).toString('hex');
      fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    }
  } catch {
    generated = crypto.randomBytes(48).toString('hex');
  }

  cachedSecrets = {
    access: crypto.createHmac('sha256', generated).update('soilsense:jwt:access:v1').digest('hex'),
    refresh: crypto.createHmac('sha256', generated).update('soilsense:jwt:refresh:v1').digest('hex'),
  };
  return cachedSecrets;
}

export interface JwtUserPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: JwtUserPayload;
}

export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, resolveJwtSecrets().access, { expiresIn: '6h' });
}

export function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, resolveJwtSecrets().refresh, { expiresIn: '14d' });
}

export function verifyRefreshToken(token: string): JwtUserPayload {
  return jwt.verify(token, resolveJwtSecrets().refresh) as JwtUserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token: string | undefined;

  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  } else if (typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
    // Supports direct PDF download links where custom Authorization headers aren't attached by browser anchors
    token = req.query.token.trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, resolveJwtSecrets().access) as JwtUserPayload;
    req.authUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid token. Please refresh or log in again.' });
  }
}
