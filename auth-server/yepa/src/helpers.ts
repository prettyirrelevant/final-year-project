import type { KVCache } from '@/common/cache';
import type { Logger } from '@/common/logger';
import type { Transporter } from 'nodemailer';

/**
 * Generates a random numeric One-Time Password (OTP) of the specified length.
 *
 * @param opts - Options for OTP generation
 * @returns A string containing the generated OTP
 * @throws Error if the specified length is less than 1
 */
export const generateOtp = (opts: { length: number }): string => {
  const { length } = opts;
  if (length < 1) {
    throw new Error('OTP length must be at least 1');
  }

  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
};

/**
 * Verifies an OTP against the stored value for a given OTP ID.
 *
 * @param options - The verification options.
 * @param options.userId - The user ID associated with the OTP.
 * @param options.cache - The cache instance for OTP storage/retrieval.
 * @param options.otpToVerify - The OTP to be compared with the one retrieved from cache.
 *
 * @returns An object with `isValid` boolean and `message` string.
 */
export async function verifyOtp(options: {
  userId: string;
  cache: KVCache;
  otpToVerify: string;
}): Promise<{ isValid: boolean; message: string }> {
  const { cache, userId, otpToVerify } = options;

  try {
    const storedOtpData = await cache.get<{ otp: string; expiresAt: string }>(
      `otp:${userId}`,
    );

    if (!storedOtpData) {
      return { isValid: false, message: 'Invalid or expired OTP' };
    }

    if (storedOtpData.otp !== otpToVerify) {
      return { isValid: false, message: 'Invalid OTP' };
    }

    if (new Date(storedOtpData.expiresAt) < new Date()) {
      return { isValid: false, message: 'Expired OTP' };
    }

    return { isValid: true, message: 'OTP verified successfully' };
  } catch (error) {
    return {
      isValid: false,
      message: 'Error occurred during OTP verification',
    };
  }
}

/**
 * Represents time units for duration calculations.
 */
type TimeUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days';

/**
 * Calculates an expiration date based on a given duration and time unit.
 *
 * @param duration - The amount of time until expiration.
 * @param unit - The time unit for the duration (default is 'milliseconds').
 * @returns A Date object representing the expiration date.
 */
export function calculateExpirationDate(
  duration: number,
  unit: TimeUnit = 'milliseconds',
): Date {
  const multipliers: Record<TimeUnit, number> = {
    milliseconds: 1,
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };

  const milliseconds = duration * multipliers[unit];
  return new Date(Date.now() + milliseconds);
}

interface OtpTemplateOptions {
  otp: string;
  expirationMinutes: number;
}

interface WelcomeTemplateOptions {
  name: string;
}

type TemplateOptions =
  | OtpTemplateOptions
  | WelcomeTemplateOptions
  | Record<string, string>;

export async function sendTransactionalEmail(
  apiKey: string,
  {
    to,
    templateName,
    templateOptions,
    logger,
  }: {
    to: string;
    logger: Logger;
    templateName: 'otp' | 'welcome';
    templateOptions: TemplateOptions;
  },
): Promise<void> {
  logger.debug({
    msg: `Attempting to send ${templateName} email to ${to}`,
    service: 'email',
  });

  const { subject, body } = generateEmailContent(templateName, templateOptions);
  const response = await fetch('https://api.useplunk.com/v1/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      body,
      subject,
    }),
  });

  const text = await response.text();
  const data = safeJsonParse(text);
  if (!response.ok) {
    throw new Error(data?.message ?? 'Unknown API Error');
  }
  logger.info({
    msg: `Successfully sent ${templateName} mail email=${to} data=${JSON.stringify(data)}`,
    service: 'email',
  });
}

function generateEmailContent(
  templateName: string,
  options: TemplateOptions,
): {
  subject: string;
  body: string;
} {
  switch (templateName) {
    case 'otp': {
      const { otp, expirationMinutes } = options as OtpTemplateOptions;
      return {
        subject: 'Your One-Time Password (OTP) -- Neuron',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Your One-Time Password (OTP)</h1>
                <p>Here is your OTP code:</p>
                <p style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${otp}</p>
                <p>Please use this code to complete your action.</p>
                <p style="font-style: italic; color: #666;">This code will expire in ${expirationMinutes} minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
              </div>
            </body>
          </html>
        `,
      };
    }
    case 'welcome': {
      const { name } = options as WelcomeTemplateOptions;
      return {
        subject: 'Welcome to Neuron',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1>Welcome, ${name}!</h1>
                <p>We're excited to have you on board.</p>
                <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
              </div>
            </body>
          </html>
        `,
      };
    }
    default:
      throw new Error(`Unsupported email template: ${templateName}`);
  }
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}
