import * as v from 'valibot';

export const AuthInitiationValidator = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty('Email is required'),
    v.email('Invalid email format'),
  ),
});

export const AuthCompletionValidator = v.object({
  id: v.pipe(v.string(), v.nonEmpty('User ID is required')),
  otp: v.pipe(
    v.string(),
    v.minLength(6, 'OTP must be at least 6 characters long'),
  ),
});
