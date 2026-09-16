import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not defined in environment variables");
  }
  return crypto.scryptSync(key, "nibss-wallet-salt", 32);
};

export const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encryptedValue (all hex encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decrypt = (encryptedData: string): string => {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encryptedHex] = encryptedData.split(":");

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  if (tag.length !== TAG_LENGTH) {
    throw new Error("Invalid authentication tag length");
  }
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
};

export const maskValue = (value: string): string => {
  // Shows last 4 digits only: ******8901
  return `******${value.slice(-4)}`;
};
