'use server';

import { signIn as authSignIn, signOut as authSignOut } from '@/auth';
import { prisma } from '@/lib/db';
import {
  signUpSchema,
  selectOrganizationSchema,
  createOrganizationSchema,
  SignUpInput,
  SelectOrganizationInput,
  CreateOrganizationInput,
} from '@/lib/validations/auth';
import { hash } from 'bcryptjs';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

// ============================================================================
// SIGN IN
// ============================================================================

export async function signInAction(email: string, password: string) {
  try {
    await authSignIn('credentials', {
      email: email.toLowerCase(),
      password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          throw new Error('Invalid email or password');
        case 'AccessDenied':
          throw new Error('Access denied');
        case 'OAuthSignin':
        case 'OAuthCallback':
        case 'EmailSignInError':
        case 'CredentialsSignin':
        case 'SessionCallback':
        case 'JWTCallback':
          throw new Error('Authentication failed');
        default:
          throw new Error('An error occurred during sign in');
      }
    }
    throw error;
  }
}

// ============================================================================
// SIGN UP
// ============================================================================

export async function signUpAction(input: SignUpInput) {
  try {
    const validated = signUpSchema.parse(input);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      throw new Error('Email already in use');
    }

    // Hash password
    const hashedPassword = await hash(validated.password, 12);

    // Create user and organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          password: hashedPassword,
        },
      });

      // Create default organization if organization name is provided
      let organization;
      if (validated.organizationName) {
        // Generate slug from name
        const slug = validated.organizationName
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');

        organization = await tx.organization.create({
          data: {
            name: validated.organizationName,
            slug: slug || 'org-' + Math.random().toString(36).substr(2, 9),
          },
        });
      } else {
        // Create default organization with user's name
        const defaultSlug = validated.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);

        organization = await tx.organization.create({
          data: {
            name: `${validated.name}'s Organization`,
            slug: defaultSlug || 'org-' + Math.random().toString(36).substr(2, 9),
          },
        });
      }

      // Add user to organization as OWNER
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      return { user, organization };
    });

    // Sign in the user
    await authSignIn('credentials', {
      email: validated.email,
      password: validated.password,
      redirect: false,
    });

    return {
      success: true,
      userId: result.user.id,
      organizationId: result.organization.id,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create account');
  }
}

// ============================================================================
// SIGN OUT
// ============================================================================

export async function signOutAction() {
  try {
    await authSignOut({ redirect: false });
  } catch (error) {
    throw new Error('Failed to sign out');
  }
}

// ============================================================================
// SELECT ORGANIZATION
// ============================================================================

export async function selectOrganizationAction(input: SelectOrganizationInput, redirectPath?: string) {
  try {
    const validated = selectOrganizationSchema.parse(input);

    // Verify user has access to this organization
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: validated.organizationId,
        },
      },
    });

    if (!membership) {
      throw new Error('You do not have access to this organization');
    }

    // Redirect to dashboard or provided path
    redirect(redirectPath || `/org/${validated.organizationId}/dashboard`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    throw new Error('Failed to select organization');
  }
}

// ============================================================================
// CREATE ORGANIZATION
// ============================================================================

export async function createOrganizationAction(
  input: CreateOrganizationInput,
  userId: string
) {
  try {
    const validated = createOrganizationSchema.parse(input);

    // Check if slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: validated.slug },
    });

    if (existingOrg) {
      throw new Error('Organization slug already exists');
    }

    // Create organization and add user as OWNER
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: validated.name,
          slug: validated.slug,
        },
      });

      await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'OWNER',
        },
      });

      return org;
    });

    return {
      success: true,
      organizationId: organization.id,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create organization');
  }
}

// ============================================================================
// GET USER ORGANIZATIONS
// ============================================================================

export async function getUserOrganizations(userId: string) {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logo: m.organization.logo,
      role: m.role,
    }));
  } catch (error) {
    throw new Error('Failed to get organizations');
  }
}

// ============================================================================
// GET CURRENT ORGANIZATION
// ============================================================================

export async function getCurrentOrganization(organizationId: string, userId: string) {
  try {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new Error('Organization not found or access denied');
    }

    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logo: membership.organization.logo,
      role: membership.role,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get organization');
  }
}

// ============================================================================
// VERIFY EMAIL
// ============================================================================

export async function sendVerificationEmail(email: string) {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate verification token
    const token = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token,
        expires: expiresAt,
      },
    });

    // TODO: Send verification email with token
    // For now, just return success
    return {
      success: true,
      message: 'Verification email sent',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to send verification email');
  }
}

// ============================================================================
// VERIFY EMAIL TOKEN
// ============================================================================

export async function verifyEmailToken(token: string, email: string) {
  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email.toLowerCase(),
          token,
        },
      },
    });

    if (!verificationToken) {
      throw new Error('Invalid verification token');
    }

    if (verificationToken.expires < new Date()) {
      throw new Error('Verification token has expired');
    }

    // Update user email verified
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email: email.toLowerCase() },
        data: { emailVerified: new Date() },
      });

      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email.toLowerCase(),
            token,
          },
        },
      });
    });

    return {
      success: true,
      message: 'Email verified successfully',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to verify email');
  }
}
