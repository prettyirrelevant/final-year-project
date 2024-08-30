import { customAlphabet } from 'nanoid';

const prefixes = {
  otp: 'otp',
  user: 'user',
  student: 'student',
  session: 'session',
  lecturer: 'lecturer',
} as const;

export const nanoid = customAlphabet(
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
);

export function newId(prefix: keyof typeof prefixes): string {
  return [prefixes[prefix], nanoid(16)].join('_');
}
