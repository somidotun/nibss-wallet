import { Resend } from "resend";

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

export const sendVerificationEmail = async (
  email: string,
  firstName: string,
  otp: string,
): Promise<void> => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn(
      "⚠️ RESEND_API_KEY is missing in environment variables. Verification email not sent.",
    );
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Verify your Nibss Wallet account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Verify your email address</h2>
          <p>Hi ${firstName},</p>
          <p>Thank you for creating a Nibss Wallet account. Use the OTP below to verify your email address:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1a1a1a; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP expires in <strong>10 minutes</strong>.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>— The Nibss Wallet Team</p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Resend failed to send email:", error);
      return;
    }

    console.log(
      `✅ Verification email sent successfully to ${email} (ID: ${data?.id})`,
    );
  } catch (err) {
    console.error("❌ Unexpected error sending verification email:", err);
  }
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
