import { env } from 'cloudflare:test';
import { newId } from '@/common/id';
import { AcademicTitle, UserType } from '@/database/enums';
import app from '@/index';
import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function generateRandomEmail(userType: UserType): string {
  const randomString = Math.random().toString(36).substring(2, 10);
  const domain =
    userType === UserType.STUDENT ? 'student.oauife.edu.ng' : 'oauife.edu.ng';
  return `test-${randomString}@${domain}`;
}

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
    },
  })),
}));

describe('Neuron API Test Suite', () => {
  const client = testClient(app, env);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await env.DB.exec('DELETE FROM sessions');
    await env.DB.exec('DELETE FROM students');
    await env.DB.exec('DELETE FROM lecturers');
    await env.DB.exec('DELETE FROM users');

    const keys = await env.KV.list();
    await Promise.all(keys.keys.map((key) => env.KV.delete(key.name)));
  });

  describe('GET /', () => {
    it('should return a welcome message', async () => {
      const res = await client.index.$get();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        message: 'neuron api is up and running!',
      });
    });
  });

  describe('POST /api/signup/initiate', () => {
    it('should initiate signup process for a new student', async () => {
      const studentEmail = generateRandomEmail(UserType.STUDENT);
      const res = await client.api.signup.initiate.$post({
        json: {
          email: studentEmail,
          userType: UserType.STUDENT,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('OTP sent to provided email address');
      expect(data.data.email).toBe(studentEmail);
      expect(data.data.userType).toBe(UserType.STUDENT);
      expect(data.data.id).toBeDefined();
    });

    it('should initiate signup process for a new lecturer', async () => {
      const lecturerEmail = generateRandomEmail(UserType.LECTURER);
      const res = await client.api.signup.initiate.$post({
        json: {
          email: lecturerEmail,
          userType: UserType.LECTURER,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('OTP sent to provided email address');
      expect(data.data.email).toBe(lecturerEmail);
      expect(data.data.userType).toBe(UserType.LECTURER);
      expect(data.data.id).toBeDefined();
    });

    it('should return error for existing email', async () => {
      const existingEmail = generateRandomEmail(UserType.STUDENT);
      const userId = newId('user');
      await env.DB.prepare(`
        INSERT INTO users (id, email, user_type, first_name, last_name)
        VALUES (?, ?, ?, 'Existing', 'User')
      `)
        .bind(userId, existingEmail, UserType.STUDENT)
        .run();

      const res = await client.api.signup.initiate.$post({
        json: {
          email: existingEmail,
          userType: UserType.STUDENT,
        },
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toBe('Email already exists');
    });
  });

  describe('POST /api/signup/student/complete', () => {
    it('should complete student signup process', async () => {
      const studentEmail = generateRandomEmail(UserType.STUDENT);
      const initiateRes = await client.api.signup.initiate.$post({
        json: {
          email: studentEmail,
          userType: UserType.STUDENT,
        },
      });
      const initiateData = await initiateRes.json();
      const { id } = initiateData.data;

      await env.KV.put(
        `otp:${id}`,
        JSON.stringify({
          otp: '123456',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        }),
      );

      const completeRes = await client.api.signup.student.complete.$post({
        json: {
          id,
          firstName: 'John',
          lastName: 'Doe',
          matricNumber: 'CSC/2020/001',
          otp: '123456',
        },
      });
      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(completeData.message).toBe(
        'Student signup completed successfully',
      );
      expect(completeData.data.firstName).toBe('John');
      expect(completeData.data.lastName).toBe('Doe');
      expect(completeData.data.matricNumber).toBe('CSC/2020/001');
    });

    it('should fail for invalid OTP', async () => {
      const studentEmail = generateRandomEmail(UserType.STUDENT);
      const initiateRes = await client.api.signup.initiate.$post({
        json: {
          email: studentEmail,
          userType: UserType.STUDENT,
        },
      });
      const initiateData = await initiateRes.json();
      const { id } = initiateData.data;

      await env.KV.put(
        `otp:${id}`,
        JSON.stringify({
          otp: '123456',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        }),
      );

      const completeRes = await client.api.signup.student.complete.$post({
        json: {
          id,
          firstName: 'John',
          lastName: 'Doe',
          matricNumber: 'CSC/2020/001',
          otp: '654321', // Wrong OTP
        },
      });
      expect(completeRes.status).toBe(400);
      const completeData = await completeRes.json();
      expect(completeData.message).toBe('Invalid OTP');
    });
  });

  describe('POST /api/signup/lecturer/complete', () => {
    it('should complete lecturer signup process', async () => {
      const lecturerEmail = generateRandomEmail(UserType.LECTURER);
      const initiateRes = await client.api.signup.initiate.$post({
        json: {
          email: lecturerEmail,
          userType: UserType.LECTURER,
        },
      });
      const initiateData = await initiateRes.json();
      const { id } = initiateData.data;

      await env.KV.put(
        `otp:${id}`,
        JSON.stringify({
          otp: '123456',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        }),
      );

      const completeRes = await client.api.signup.lecturer.complete.$post({
        json: {
          id,
          firstName: 'Jane',
          lastName: 'Doe',
          title: AcademicTitle.PROFESSOR,
          faculty: 'Science',
          department: 'Computer Science',
          otp: '123456',
        },
      });
      expect(completeRes.status).toBe(200);
      const completeData = await completeRes.json();
      expect(completeData.message).toBe(
        'Lecturer signup completed successfully',
      );
      expect(completeData.data.firstName).toBe('Jane');
      expect(completeData.data.lastName).toBe('Doe');
      expect(completeData.data.title).toBe(AcademicTitle.PROFESSOR);
      expect(completeData.data.faculty).toBe('Science');
      expect(completeData.data.department).toBe('Computer Science');
    });
  });

  describe('POST /api/login/initiate', () => {
    it('should initiate login process for existing user', async () => {
      const userEmail = generateRandomEmail(UserType.STUDENT);
      const userId = newId('user');
      await env.DB.prepare(`
        INSERT INTO users (id, email, user_type, first_name, last_name)
        VALUES (?, ?, ?, 'Test', 'User')
      `)
        .bind(userId, userEmail, UserType.STUDENT)
        .run();

      const res = await client.api.login.initiate.$post({
        json: {
          email: userEmail,
          userType: UserType.STUDENT,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('OTP sent to provided email address');
      expect(data.data.id).toBeDefined();
    });

    it('should return error for non-existent user', async () => {
      const nonExistentEmail = generateRandomEmail(UserType.STUDENT);
      const res = await client.api.login.initiate.$post({
        json: {
          email: nonExistentEmail,
          userType: UserType.STUDENT,
        },
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe('User not found');
    });
  });

  describe('POST /api/login/complete', () => {
    it('should complete login process', async () => {
      const userEmail = generateRandomEmail(UserType.STUDENT);
      const userId = newId('user');
      await env.DB.prepare(`
        INSERT INTO users (id, email, user_type, first_name, last_name)
        VALUES (?, ?, ?, 'Test', 'User')
      `)
        .bind(userId, userEmail, UserType.STUDENT)
        .run();

      await env.KV.put(
        `otp:${userId}`,
        JSON.stringify({
          otp: '123456',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        }),
      );

      const res = await client.api.login.complete.$post({
        json: {
          id: userId,
          otp: '123456',
          deviceId: 'device123',
          deviceName: 'Test Device',
          deviceOs: 'iOS',
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Login successful');
      expect(data.data.sessionId).toBeDefined();
    });
  });

  describe('POST /api/logout', () => {
    it('should log out user', async () => {
      const userEmail = generateRandomEmail(UserType.STUDENT);
      const userId = newId('user');
      await env.DB.prepare(`
        INSERT INTO users (id, email, user_type, first_name, last_name)
        VALUES (?, ?, ?, 'Test', 'User')
      `)
        .bind(userId, userEmail, UserType.STUDENT)
        .run();

      const sessionId = newId('session');
      await env.DB.prepare(`
        INSERT INTO sessions (id, user_id, is_active, device_id, device_name, device_os)
        VALUES (?, ?, true, 'device123', 'Test Device', 'iOS')
      `)
        .bind(sessionId, userId)
        .run();

      const res = await client.api.logout.$post({
        json: {
          sessionId: sessionId,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Logged out successfully');

      const { results } = await env.DB.prepare(`
        SELECT is_active FROM sessions WHERE id = ?
      `)
        .bind(sessionId)
        .run();
      expect(results[0].is_active).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const res = await client.api.nonexistentroute.$get();
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.message).toBe('/api/nonexistentroute not found');
    });

    it('should handle internal server errors', async () => {
      const originalPrepare = env.DB.prepare;
      env.DB.prepare = vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValueOnce(new Error('Database error')),
      }));

      const userEmail = generateRandomEmail(UserType.STUDENT);
      const res = await client.api.login.initiate.$post({
        json: {
          email: userEmail,
          userType: UserType.STUDENT,
        },
      });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.message).toBe('Internal server error');

      // Restore the original prepare function
      env.DB.prepare = originalPrepare;
    });
  });
});
