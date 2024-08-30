import { env } from 'cloudflare:test';
import { KVCache } from '@/common/cache';
import { type Logger, createLogger } from '@/common/logger';
import {
  calculateExpirationDate,
  generateOtp,
  sendTransactionalEmail,
  verifyOtp,
} from '@/helpers';
import type { Resend } from 'resend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('resend');

describe('Helpers', () => {
  let cache: KVCache;
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger({ level: 'debug', mode: 'pretty' });
    cache = new KVCache({ kv: env.KV, logger });
  });

  describe('generateOtp', () => {
    it('should generate OTP of specified length', () => {
      const otp = generateOtp({ length: 6 });
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate different OTPs on subsequent calls', () => {
      const otp1 = generateOtp({ length: 6 });
      const otp2 = generateOtp({ length: 6 });
      expect(otp1).not.toBe(otp2);
    });

    it('should throw error for length less than 1', () => {
      expect(() => generateOtp({ length: 0 })).toThrow(
        'OTP length must be at least 1',
      );
    });

    it('should generate OTP of length 1 when specified', () => {
      const otp = generateOtp({ length: 1 });
      expect(otp).toHaveLength(1);
      expect(otp).toMatch(/^\d$/);
    });
  });

  describe('verifyOtp', () => {
    it('should return true for valid OTP', async () => {
      const userId = 'user123';
      const otp = '123456';
      await cache.set(`otp:${userId}`, {
        otp,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const result = await verifyOtp({
        userId,
        cache,
        otpToVerify: otp,
      });
      expect(result).toEqual({
        isValid: true,
        message: 'OTP verified successfully',
      });
    });

    it('should return false for invalid OTP', async () => {
      const userId = 'user123';
      const otp = '123456';
      await cache.set(`otp:${userId}`, {
        otp,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const result = await verifyOtp({
        userId,
        cache,
        otpToVerify: '654321',
      });
      expect(result).toEqual({ isValid: false, message: 'Invalid OTP' });
    });

    it('should return false for expired OTP', async () => {
      const userId = 'user123';
      const otp = '123456';
      await cache.set(`otp:${userId}`, {
        otp,
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });

      const result = await verifyOtp({
        userId,
        cache,
        otpToVerify: otp,
      });
      expect(result).toEqual({ isValid: false, message: 'Expired OTP' });
    });

    it('should return false for non-existent OTP', async () => {
      const result = await verifyOtp({
        userId: 'nonexistent',
        cache,
        otpToVerify: '123456',
      });
      expect(result).toEqual({
        isValid: false,
        message: 'Invalid or expired OTP',
      });
    });
  });

  describe('calculateExpirationDate', () => {
    it('should calculate correct expiration date for milliseconds', () => {
      const expiration = calculateExpirationDate(5000);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
      expect(expiration.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it('should calculate correct expiration date for seconds', () => {
      const expiration = calculateExpirationDate(60, 'seconds');
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
      expect(expiration.getTime()).toBeLessThanOrEqual(Date.now() + 60000);
    });

    it('should calculate correct expiration date for minutes', () => {
      const expiration = calculateExpirationDate(5, 'minutes');
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
      expect(expiration.getTime()).toBeLessThanOrEqual(
        Date.now() + 5 * 60 * 1000,
      );
    });

    it('should calculate correct expiration date for hours', () => {
      const expiration = calculateExpirationDate(2, 'hours');
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
      expect(expiration.getTime()).toBeLessThanOrEqual(
        Date.now() + 2 * 60 * 60 * 1000,
      );
    });

    it('should calculate correct expiration date for days', () => {
      const expiration = calculateExpirationDate(1, 'days');
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
      expect(expiration.getTime()).toBeLessThanOrEqual(
        Date.now() + 24 * 60 * 60 * 1000,
      );
    });
  });

  describe('sendTransactionalEmail', () => {
    let mockResend: Resend;

    beforeEach(() => {
      mockResend = {
        emails: {
          send: vi
            .fn()
            .mockResolvedValue({ data: { id: 'email123' }, error: null }),
        },
      } as unknown as Resend;
    });

    it('should send OTP email successfully', async () => {
      await sendTransactionalEmail(mockResend, {
        to: 'user@example.com',
        templateName: 'otp',
        templateOptions: { otp: '123456', expirationMinutes: 10 },
        logger,
      });

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: expect.stringContaining('One-Time Password'),
          html: expect.stringContaining('123456'),
        }),
      );
    });

    it('should send welcome email successfully', async () => {
      await sendTransactionalEmail(mockResend, {
        to: 'user@example.com',
        templateName: 'welcome',
        templateOptions: { name: 'John Doe' },
        logger,
      });

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: expect.stringContaining('Welcome to Neuron'),
          html: expect.stringContaining('John Doe'),
        }),
      );
    });

    it('should throw error for unsupported email template', async () => {
      await expect(
        sendTransactionalEmail(mockResend, {
          to: 'user@example.com',
          templateName: 'unsupported' as any,
          templateOptions: {},
          logger,
        }),
      ).rejects.toThrow('Unsupported email template');
    });

    it('should handle email sending errors (thrown error)', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Sending failed'));

      await expect(
        sendTransactionalEmail(mockResend, {
          to: 'user@example.com',
          templateName: 'otp',
          templateOptions: { otp: '123456', expirationMinutes: 10 },
          logger,
        }),
      ).rejects.toThrow('Sending failed');
    });

    it('should handle email sending errors (returned error object)', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'API Error', statusCode: 400 },
      });

      await expect(
        sendTransactionalEmail(mockResend, {
          to: 'user@example.com',
          templateName: 'otp',
          templateOptions: { otp: '123456', expirationMinutes: 10 },
          logger,
        }),
      ).rejects.toThrow('API Error');
    });
  });
});
