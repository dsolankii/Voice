import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { UserModel } from "../users/user.model.js";
import type { LoginInput, SignupInput } from "./auth.schemas.js";

function signToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign({ sub: userId }, env.jwtSecret, options);
}

function toSafeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function signup(input: SignupInput) {
  const existingUser = await UserModel.findOne({ email: input.email });

  if (existingUser) {
    const error = new Error("Email is already registered");
    error.name = "ConflictError";
    throw error;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  const token = signToken(String(user._id));

  return {
    user: toSafeUser(user),
    token,
  };
}

export async function login(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email });

  if (!user) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  const token = signToken(String(user._id));

  return {
    user: toSafeUser(user),
    token,
  };
}

export async function getUserById(userId: string) {
  const user = await UserModel.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.name = "UnauthorizedError";
    throw error;
  }

  return toSafeUser(user);
}
