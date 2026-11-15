/* eslint-disable no-console */
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import User from "../models/user.model.js";

dotenv.config();

const main = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const phone = process.env.ADMIN_PHONE;

  if (!email || !password || !phone) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_PHONE in .env");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(
      existing.role === "admin"
        ? "Admin already exists. Nothing to do."
        : "A user with this email exists but is not an admin. Promote it manually.",
    );
    return;
  }

  await User.create({
    firstName: "System",
    lastName: "Admin",
    email,
    phone,
    password, // hashed by the model's pre-save hook
    role: "admin",
    isEmailVerified: true,
    status: "active",
  });
  console.log(`Admin created: ${email}`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
