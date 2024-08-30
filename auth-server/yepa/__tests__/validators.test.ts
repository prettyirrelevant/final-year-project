import { AcademicTitle, UserType } from '@/database/enums';
import {
  LecturerSignUpCompletionValidator,
  LoginCompletionValidator,
  LoginInitiationValidator,
  LogoutValidator,
  SignUpInitiationValidator,
  StudentSignUpCompletionValidator,
} from '@/validators';
import { ValiError, parse } from 'valibot';
import { describe, expect, it } from 'vitest';

describe('Validators', () => {
  describe('SignUpInitiationValidator', () => {
    it('should pass for valid student input', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: UserType.STUDENT,
      };
      expect(() => parse(SignUpInitiationValidator, input)).not.toThrow();
    });

    it('should pass for valid lecturer input', () => {
      const input = {
        email: 'lecturer@oauife.edu.ng',
        userType: UserType.LECTURER,
      };
      expect(() => parse(SignUpInitiationValidator, input)).not.toThrow();
    });

    it('should fail for mismatched email and user type (student email, lecturer type)', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: UserType.LECTURER,
      };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for mismatched email and user type (lecturer email, student type)', () => {
      const input = {
        email: 'lecturer@oauife.edu.ng',
        userType: UserType.STUDENT,
      };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for invalid email format', () => {
      const input = { email: 'invalid-email', userType: UserType.STUDENT };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for empty email', () => {
      const input = { email: '', userType: UserType.STUDENT };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for invalid user type', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: 'INVALID_TYPE',
      };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for email from different domain', () => {
      const input = {
        email: 'student@otherdomain.com',
        userType: UserType.STUDENT,
      };
      expect(() => parse(SignUpInitiationValidator, input)).toThrow(ValiError);
    });
  });

  describe('StudentSignUpCompletionValidator', () => {
    it('should pass for valid input', () => {
      const input = {
        matricNumber: 'CSC/2020/001',
        firstName: 'John',
        lastName: 'Doe',
        otp: '123456',
        id: 'user_123',
      };
      expect(() =>
        parse(StudentSignUpCompletionValidator, input),
      ).not.toThrow();
    });

    it('should fail for invalid matric number format', () => {
      const input = {
        matricNumber: 'INVALID',
        firstName: 'John',
        lastName: 'Doe',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(StudentSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for empty first name', () => {
      const input = {
        matricNumber: 'CSC/2020/001',
        firstName: '',
        lastName: 'Doe',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(StudentSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for empty last name', () => {
      const input = {
        matricNumber: 'CSC/2020/001',
        firstName: 'John',
        lastName: '',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(StudentSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for OTP shorter than 6 characters', () => {
      const input = {
        matricNumber: 'CSC/2020/001',
        firstName: 'John',
        lastName: 'Doe',
        otp: '12345',
        id: 'user_123',
      };
      expect(() => parse(StudentSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for empty id', () => {
      const input = {
        matricNumber: 'CSC/2020/001',
        firstName: 'John',
        lastName: 'Doe',
        otp: '123456',
        id: '',
      };
      expect(() => parse(StudentSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });
  });

  describe('LecturerSignUpCompletionValidator', () => {
    it('should pass for valid input', () => {
      const input = {
        department: 'Computer Science',
        firstName: 'Jane',
        lastName: 'Doe',
        faculty: 'Science',
        otp: '123456',
        id: 'user_123',
        title: AcademicTitle.PROFESSOR,
      };
      expect(() =>
        parse(LecturerSignUpCompletionValidator, input),
      ).not.toThrow();
    });

    it('should fail for invalid title', () => {
      const input = {
        department: 'Computer Science',
        firstName: 'Jane',
        lastName: 'Doe',
        faculty: 'Science',
        otp: '123456',
        id: 'user_123',
        title: 'Invalid Title',
      };
      expect(() => parse(LecturerSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for empty department', () => {
      const input = {
        department: '',
        firstName: 'Jane',
        lastName: 'Doe',
        faculty: 'Science',
        otp: '123456',
        id: 'user_123',
        title: AcademicTitle.PROFESSOR,
      };
      expect(() => parse(LecturerSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for empty faculty', () => {
      const input = {
        department: 'Computer Science',
        firstName: 'Jane',
        lastName: 'Doe',
        faculty: '',
        otp: '123456',
        id: 'user_123',
        title: AcademicTitle.PROFESSOR,
      };
      expect(() => parse(LecturerSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });

    it('should fail for OTP shorter than 6 characters', () => {
      const input = {
        department: 'Computer Science',
        firstName: 'Jane',
        lastName: 'Doe',
        faculty: 'Science',
        otp: '12345',
        id: 'user_123',
        title: AcademicTitle.PROFESSOR,
      };
      expect(() => parse(LecturerSignUpCompletionValidator, input)).toThrow(
        ValiError,
      );
    });
  });

  describe('LoginInitiationValidator', () => {
    it('should pass for valid student input', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: UserType.STUDENT,
      };
      expect(() => parse(LoginInitiationValidator, input)).not.toThrow();
    });

    it('should pass for valid lecturer input', () => {
      const input = {
        email: 'lecturer@oauife.edu.ng',
        userType: UserType.LECTURER,
      };
      expect(() => parse(LoginInitiationValidator, input)).not.toThrow();
    });

    it('should fail for mismatched email and user type (student email, lecturer type)', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: UserType.LECTURER,
      };
      expect(() => parse(LoginInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for mismatched email and user type (lecturer email, student type)', () => {
      const input = {
        email: 'lecturer@oauife.edu.ng',
        userType: UserType.STUDENT,
      };
      expect(() => parse(LoginInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for invalid email format', () => {
      const input = { email: 'invalid-email', userType: UserType.STUDENT };
      expect(() => parse(LoginInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for empty email', () => {
      const input = { email: '', userType: UserType.STUDENT };
      expect(() => parse(LoginInitiationValidator, input)).toThrow(ValiError);
    });

    it('should fail for invalid user type', () => {
      const input = {
        email: 'student@student.oauife.edu.ng',
        userType: 'INVALID_TYPE',
      };
      expect(() => parse(LoginInitiationValidator, input)).toThrow(ValiError);
    });
  });

  describe('LoginCompletionValidator', () => {
    it('should pass for valid input', () => {
      const input = {
        deviceName: 'iPhone 12',
        deviceId: 'device_123',
        deviceOs: 'iOS 15.0',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(LoginCompletionValidator, input)).not.toThrow();
    });

    it('should fail for empty device name', () => {
      const input = {
        deviceName: '',
        deviceId: 'device_123',
        deviceOs: 'iOS 15.0',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(LoginCompletionValidator, input)).toThrow(ValiError);
    });

    it('should fail for empty device ID', () => {
      const input = {
        deviceName: 'iPhone 12',
        deviceId: '',
        deviceOs: 'iOS 15.0',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(LoginCompletionValidator, input)).toThrow(ValiError);
    });

    it('should fail for empty device OS', () => {
      const input = {
        deviceName: 'iPhone 12',
        deviceId: 'device_123',
        deviceOs: '',
        otp: '123456',
        id: 'user_123',
      };
      expect(() => parse(LoginCompletionValidator, input)).toThrow(ValiError);
    });

    it('should fail for OTP shorter than 6 characters', () => {
      const input = {
        deviceName: 'iPhone 12',
        deviceId: 'device_123',
        deviceOs: 'iOS 15.0',
        otp: '12345',
        id: 'user_123',
      };
      expect(() => parse(LoginCompletionValidator, input)).toThrow(ValiError);
    });

    it('should fail for empty id', () => {
      const input = {
        deviceName: 'iPhone 12',
        deviceId: 'device_123',
        deviceOs: 'iOS 15.0',
        otp: '123456',
        id: '',
      };
      expect(() => parse(LoginCompletionValidator, input)).toThrow(ValiError);
    });
  });

  describe('LogoutValidator', () => {
    it('should pass for valid input', () => {
      const input = { sessionId: 'session_123' };
      expect(() => parse(LogoutValidator, input)).not.toThrow();
    });

    it('should fail for empty session ID', () => {
      const input = { sessionId: '' };
      expect(() => parse(LogoutValidator, input)).toThrow(ValiError);
    });

    it('should fail for non-string session ID', () => {
      const input = { sessionId: 123 };
      expect(() => parse(LogoutValidator, input)).toThrow(ValiError);
    });
  });
});
