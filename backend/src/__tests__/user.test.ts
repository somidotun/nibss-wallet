import request from "supertest";
import app from "../app.js";
import { api, authHeader, createVerifiedUser, setPin } from "./helpers.js";

const me = (token: string) =>
  request(app).get(`${api}/users/me`).set(authHeader(token));

describe("GET /users/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`${api}/users/me`);
    expect(res.status).toBe(401);
  });

  it("returns the profile without sensitive fields", async () => {
    const user = await createVerifiedUser();
    const res = await me(user.token);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.transactionPin).toBeUndefined();
  });
});

describe("PATCH /users/me", () => {
  it("updates the name and leaves the phone unchanged", async () => {
    const user = await createVerifiedUser();
    const before = (await me(user.token)).body.data.user.phone;
    const res = await request(app)
      .patch(`${api}/users/me`)
      .set(authHeader(user.token))
      .send({ firstName: "Ayo", lastName: "Oluwole" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe("Ayo");
    expect(res.body.data.user.phone).toBe(before);
  });

  it("rejects a name containing digits", async () => {
    const user = await createVerifiedUser();
    const res = await request(app)
      .patch(`${api}/users/me`)
      .set(authHeader(user.token))
      .send({ firstName: "Ayo123" });
    expect(res.status).toBe(400);
  });

  it("rejects a phone number used by another user", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser();
    const aPhone = (await me(a.token)).body.data.user.phone;
    const res = await request(app)
      .patch(`${api}/users/me`)
      .set(authHeader(b.token))
      .send({ phone: aPhone });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /users/me/change-password", () => {
  const change = (token: string, body: Record<string, string>) =>
    request(app)
      .patch(`${api}/users/me/change-password`)
      .set(authHeader(token))
      .send(body);

  it("rejects a wrong current password", async () => {
    const user = await createVerifiedUser();
    const res = await change(user.token, {
      currentPassword: "WrongPassword1!",
      newPassword: "NewPassword456!",
    });
    expect(res.status).toBe(401);
  });

  it("rejects reusing the same password", async () => {
    const user = await createVerifiedUser();
    const res = await change(user.token, {
      currentPassword: user.password,
      newPassword: user.password,
    });
    expect(res.status).toBe(400);
  });

  it("changes the password so only the new one logs in", async () => {
    const user = await createVerifiedUser();
    const res = await change(user.token, {
      currentPassword: user.password,
      newPassword: "NewPassword456!",
    });
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: user.password });
    const newLogin = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: user.email, password: "NewPassword456!" });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });
});

describe("POST /users/me/set-pin", () => {
  it("sets a 4-digit PIN and marks the onboarding step", async () => {
    const user = await createVerifiedUser();
    const res = await setPin(user.token);
    expect(res.status).toBe(200);
    const profile = await me(user.token);
    expect(profile.body.data.user.onboarding.steps.pin).toBe(true);
  });

  it.each(["abc1", "123", "12345"])("rejects invalid PIN %s", async (pin) => {
    const user = await createVerifiedUser();
    const res = await setPin(user.token, pin);
    expect(res.status).toBe(400);
  });
});
