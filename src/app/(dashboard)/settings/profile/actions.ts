'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth/server/supabase';
import { db } from '@/lib/db';
import { securityEvents, users } from '@/lib/db/schema';
import {
  type ActionResult,
  createErrorResponse,
  createSuccessResponse,
  handleServerActionError,
} from '@/lib/utils/form-errors';
import {
  avatarUploadSchema,
  updateEmailSchema,
  updateProfileSchema,
} from '@/lib/validations/profile';

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  try {
    // Validate form data
    const validatedData = updateProfileSchema.parse({
      fullName: formData.get('full_name'),
      displayName: formData.get('display_name'),
      bio: formData.get('bio') || undefined,
      timezone: formData.get('timezone') || undefined,
    });

    // Update user profile in database
    await db
      .update(users)
      .set({
        fullName: validatedData.fullName,
        displayName: validatedData.displayName,
        bio: validatedData.bio,
        timezone: validatedData.timezone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.id));

    // Log security event
    await db.insert(securityEvents).values({
      userId: session.id,
      eventType: 'profile_update',
      eventData: {
        updatedFields: Object.keys(validatedData),
      },
      success: true,
    });

    revalidatePath('/settings/profile');

    return createSuccessResponse(validatedData, 'Profile updated successfully');
  } catch (error) {
    // Log failed attempt
    if (session?.id) {
      await db.insert(securityEvents).values({
        userId: session.id,
        eventType: 'profile_update',
        eventData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        success: false,
      });
    }

    return handleServerActionError(
      error,
      'Failed to update profile. Please try again.'
    );
  }
}

export async function updateEmail(formData: FormData): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  try {
    const validatedData = updateEmailSchema.parse({
      email: formData.get('email'),
    });

    // Check if email is already taken
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser.length > 0 && existingUser[0].id !== session.id) {
      return createErrorResponse('This email address is already in use.');
    }

    // Update email in database
    await db
      .update(users)
      .set({
        email: validatedData.email,
        emailVerified: false, // Reset verification status
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.id));

    // Log security event
    await db.insert(securityEvents).values({
      userId: session.id,
      eventType: 'email_change',
      eventData: {
        newEmail: validatedData.email,
      },
      success: true,
    });

    revalidatePath('/settings/profile');

    return createSuccessResponse(
      validatedData,
      'Email updated successfully. Please check your new email to verify it.'
    );
  } catch (error) {
    // Log failed attempt
    if (session?.id) {
      await db.insert(securityEvents).values({
        userId: session.id,
        eventType: 'email_change',
        eventData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        success: false,
      });
    }

    return handleServerActionError(
      error,
      'Failed to update email. Please try again.'
    );
  }
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  try {
    const file = formData.get('avatar') as File;

    if (!file) {
      return createErrorResponse('No file provided');
    }

    // Validate file using schema
    avatarUploadSchema.parse({ avatar: file });

    // TODO: Implement actual file upload to Supabase Storage
    // For now, we'll just simulate success
    const avatarUrl = `/avatars/${session.id}-${Date.now()}.${file.type.split('/')[1]}`;

    // Update avatar URL in database
    await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.id));

    // Log security event
    await db.insert(securityEvents).values({
      userId: session.id,
      eventType: 'avatar_update',
      eventData: {
        fileName: file.name,
        fileSize: file.size,
      },
      success: true,
    });

    revalidatePath('/settings/profile');

    return createSuccessResponse({ avatarUrl }, 'Avatar updated successfully');
  } catch (error) {
    // Log failed attempt
    if (session?.id) {
      await db.insert(securityEvents).values({
        userId: session.id,
        eventType: 'avatar_update',
        eventData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        success: false,
      });
    }

    return handleServerActionError(
      error,
      'Failed to upload avatar. Please try again.'
    );
  }
}

export async function deleteAccount(): Promise<ActionResult> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  try {
    // Log security event before deletion
    await db.insert(securityEvents).values({
      userId: session.id,
      eventType: 'account_deletion',
      eventData: {
        deletedAt: new Date().toISOString(),
      },
      success: true,
    });

    // Delete user account (this will cascade to related records)
    await db.delete(users).where(eq(users.id, session.id));

    // Redirect to logout/goodbye page
    redirect('/');
  } catch (error) {
    return handleServerActionError(
      error,
      'Failed to delete account. Please try again.'
    );
  }
}
