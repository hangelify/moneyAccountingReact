import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

/**
 * Sign-up password schema.
 * Requirements (match the API):
 * - Minimum 8 characters
 * - At most 72 bytes when UTF-8 encoded (bcrypt limit)
 */
const MAX_PASSWORD_BYTES = 72;
const MAX_NAME_LENGTH = 255;

const signUpPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters long')
  .refine((pw) => new TextEncoder().encode(pw).length <= MAX_PASSWORD_BYTES, {
    message: 'Password must be at most 72 bytes long',
  });

const loginPasswordSchema = z.string().min(1, 'Password is required');

/**
 * First name validation schema
 */
export const firstNameSchema = z
  .string()
  .trim()
  .min(1, 'First name is required')
  .max(MAX_NAME_LENGTH, 'First name must be at most 255 characters');

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

/**
 * Register form schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: signUpPasswordSchema,
  first_name: firstNameSchema,
  last_name: z
    .string()
    .max(MAX_NAME_LENGTH, 'Last name must be at most 255 characters')
    .optional(),
  username: z
    .string()
    .max(MAX_NAME_LENGTH, 'Username must be at most 255 characters')
    .optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
