import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Fixed test values, so tests never depend on your real .env
Object.assign(process.env, {
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  ENCRYPTION_KEY: "test-encryption-key-for-jest-only",
  RESEND_API_KEY: "re_test_key",
  FROM_EMAIL: "onboarding@resend.dev",
});

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  // Replica set (not standalone) so session transactions work
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}, 60000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
});
