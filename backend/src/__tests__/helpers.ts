import request from "supertest";
import app from "../app.js";
import User from "../models/user.model.js";

export const api = "/api/v1";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  token: string;
  accountNumber: string;
}

let counter = 0;

export const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const getOtp = async (id: string): Promise<string> => {
  const user = await User.findById(id).select("+emailVerificationOTP");
  return user!.emailVerificationOTP as string;
};

// Registers a user but does NOT verify the email
export const registerUser = async (
  overrides: Partial<Record<string, string>> = {},
) => {
  counter += 1;
  const body = {
    firstName: "Test",
    lastName: "User",
    email: `user${counter}@test.com`,
    phone: `0801234${String(counter).padStart(4, "0")}`,
    password: "Password123!",
    ...overrides,
  };
  const res = await request(app).post(`${api}/auth/register`).send(body);
  return {
    res,
    body,
    id: res.body.data?.user?.id as string,
    token: res.body.data?.accessToken as string,
  };
};

// Registers, verifies the email, and returns the user with their account number
export const createVerifiedUser = async (): Promise<TestUser> => {
  const { body, id, token } = await registerUser();
  await request(app)
    .post(`${api}/auth/verify-email`)
    .set(authHeader(token))
    .send({ otp: await getOtp(id) });
  const wallet = await request(app).get(`${api}/wallet`).set(authHeader(token));
  return {
    id,
    email: body.email,
    password: body.password,
    token,
    accountNumber: wallet.body.data.wallet.accountNumber,
  };
};

export const setPin = (token: string, pin = "1234") =>
  request(app)
    .post(`${api}/users/me/set-pin`)
    .set(authHeader(token))
    .send({ pin });

export const transfer = (
  from: TestUser,
  to: TestUser,
  amount = 5000,
  extra: Record<string, unknown> = {},
) =>
  request(app)
    .post(`${api}/wallet/transfer`)
    .set(authHeader(from.token))
    .send({
      accountNumber: to.accountNumber,
      amount,
      pin: "1234",
      idempotencyKey: `key-${Date.now()}-${Math.random()}`,
      ...extra,
    });

export const balanceOf = async (user: TestUser): Promise<number> => {
  const res = await request(app)
    .get(`${api}/wallet/balance`)
    .set(authHeader(user.token));
  return res.body.data.balance;
};
