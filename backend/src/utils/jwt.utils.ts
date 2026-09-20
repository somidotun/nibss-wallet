import jwt from "jsonwebtoken";
import type { StringValue } from "ms";

export interface JwtPayload {
  userId: string;
  role: "user" | "admin";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not defined");
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not defined");
  return secret;
};

export const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as StringValue,
  });
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as StringValue,
  });
};

export const generateTokenPair = (payload: JwtPayload): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, getAccessSecret()) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, getRefreshSecret()) as JwtPayload;
};
