import { z } from 'zod';
import { LIMIT_PERIOD_TYPES } from './limitPeriods';

/**
 * Email validation schema
 */
const emailSchema = z
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

/**
 * Household settings form schema
 */
export const householdSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(MAX_NAME_LENGTH, 'Name must be at most 255 characters'),
  currency: z.string().min(1),
});

const householdNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, 'Name must be at most 255 characters');

export const ownHouseholdNameSchema = z.object({
  display_name: householdNameSchema,
});

export const createHouseholdSchema = z.object({
  name: householdNameSchema,
  currency: z.string().min(1),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type CreateHouseholdFormData = z.infer<typeof createHouseholdSchema>;
export type OwnHouseholdNameFormData = z.infer<typeof ownHouseholdNameSchema>;
export type HouseholdSettingsFormData = z.infer<typeof householdSettingsSchema>;

/** Upper bound of a money amount, same as the server's `MAX_MONEY_AMOUNT`. */
const MAX_LIMIT_AMOUNT = 1e12;

/** Why a typed limit amount is invalid, or `null` when it is fine. */
function limitAmountProblem(value: string): string | null {
  if (value === '') return 'Enter an amount';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Enter a number';
  if (amount <= 0) return 'Amount must be greater than 0';
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'At most 2 decimal places';
  if (amount > MAX_LIMIT_AMOUNT) return 'Amount is too large';
  return null;
}

/** Amount typed by a person: a comma is a decimal separator. */
const limitAmountSchema = z
  .string()
  .trim()
  .transform((raw) => raw.replace(',', '.'))
  .superRefine((value, ctx) => {
    const message = limitAmountProblem(value);
    if (message !== null) ctx.addIssue({ code: 'custom', message });
  })
  .transform(Number);

/** Inline form of a category limit. */
export const categoryLimitSchema = z.object({
  amount: limitAmountSchema,
  period_type: z.enum(LIMIT_PERIOD_TYPES),
});

export type CategoryLimitFormInput = z.input<typeof categoryLimitSchema>;
export type CategoryLimitFormData = z.output<typeof categoryLimitSchema>;
