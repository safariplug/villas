import { z } from 'zod';

// ============================================================================
// AUTHENTICATION VALIDATION SCHEMAS
// ============================================================================

export const signInSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters'),
});

export const signUpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
  organizationName: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name must be 255 characters or less')
    .optional(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export const resetPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
});

export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export const selectOrganizationSchema = z.object({
  organizationId: z.string().cuid('Invalid organization ID'),
});

export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name must be 255 characters or less'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be 100 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyResetTokenInput = z.infer<typeof verifyResetTokenSchema>;
export type SelectOrganizationInput = z.infer<typeof selectOrganizationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
