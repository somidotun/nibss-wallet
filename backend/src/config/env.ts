const REQUIRED = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ENCRYPTION_KEY",
];
const SECRETS = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "ENCRYPTION_KEY"];
const PLACEHOLDER = /nibss_wallet|key_here|changeme/i;

export const validateEnv = (env: NodeJS.ProcessEnv = process.env): string[] => {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    if (!env[key]) problems.push(`${key} is not set`);
  }

  if (env.NODE_ENV === "production") {
    for (const key of [
      "RESEND_API_KEY",
      "FRONTEND_URL",
      "PAYSTACK_SECRET_KEY",
    ]) {
      if (!env[key]) problems.push(`${key} is not set`);
    }
    for (const key of SECRETS) {
      const value = env[key];
      if (!value) continue;
      if (value.length < 32)
        problems.push(`${key} must be at least 32 characters in production`);
      if (PLACEHOLDER.test(value))
        problems.push(`${key} still has a placeholder value`);
    }
  }

  if (
    env.JWT_ACCESS_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }

  if (env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")) {
    problems.push(
      "Live Paystack keys are not allowed in this project (use sk_test_...)",
    );
  }

  return problems;
};

export const assertEnv = (): void => {
  const problems = validateEnv();
  if (problems.length > 0) {
    console.error("Invalid environment configuration:");
    problems.forEach((p) => console.error(` - ${p}`));
    process.exit(1);
  }
};
