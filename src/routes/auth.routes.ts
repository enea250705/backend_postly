import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async";
import { authRateLimit } from "../middleware/rateLimit";
import * as auth from "../services/auth.service";

export const authRouter = Router();

authRouter.use(authRateLimit);

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
  niche: z.string().optional(),
});

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body);
    const tokens = await auth.signup(body);
    res.status(201).json(tokens);
  }),
);

const loginSchema = z.object({ email: z.string().email(), password: z.string() });
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await auth.login(email, password));
  }),
);

const refreshSchema = z.object({ refreshToken: z.string() });
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    res.json(await auth.refresh(refreshToken));
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await auth.logout(refreshToken);
    res.status(204).end();
  }),
);
