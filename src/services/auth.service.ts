import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { BadRequest, Conflict, Unauthorized } from "../utils/errors";

const ACCESS_OPTS: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
const REFRESH_OPTS: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any };

export interface SignupInput {
  email: string;
  password: string;
  displayName?: string;
  niche?: string;
}

export const signup = async (input: SignupInput) => {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw Conflict("Email already in use");
  if (input.password.length < 8) throw BadRequest("Password must be at least 8 characters");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      displayName: input.displayName,
      niche: input.niche,
    },
  });
  return issueTokens(user);
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) throw Unauthorized("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Unauthorized("Invalid credentials");
  return issueTokens(user);
};

export const refresh = async (refreshToken: string) => {
  let payload: { sub: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch {
    throw Unauthorized("Invalid refresh token");
  }
  const tokenHash = hash(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date())
    throw Unauthorized("Refresh token expired");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Unauthorized();
  // rotate
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(user);
};

export const logout = async (refreshToken: string) => {
  const tokenHash = hash(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

const issueTokens = async (user: { id: string; plan: any }) => {
  const accessToken = jwt.sign({ sub: user.id, plan: user.plan }, env.JWT_SECRET, ACCESS_OPTS);
  const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, REFRESH_OPTS);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken, userId: user.id };
};

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
