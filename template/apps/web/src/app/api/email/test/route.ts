import { NextRequest, NextResponse } from 'next/server';

import { EmailService } from '@/lib/email/service';
import { EmailDatabase } from '@/lib/email/database';

/**
 * GET /api/email/test
 * Test email system connectivity and functionality
 */
export async function GET() {
  try {
    const tests = {
      resendConnection: false,
      databaseConnection: false,
      errors: [] as string[],
    };

    // Test Resend connection
    try {
      const resendTest = await EmailService.testConnection();
      tests.resendConnection = resendTest.success;
      if (!resendTest.success && resendTest.error) {
        tests.errors.push(`Resend: ${resendTest.error}`);
      }
    } catch (error) {
      tests.resendConnection = false;
      tests.errors.push(`Resend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Test database connection
    try {
      const dbTest = await EmailDatabase.testConnection();
      tests.databaseConnection = dbTest.success;
      if (!dbTest.success && dbTest.error) {
        tests.errors.push(`Database: ${dbTest.error}`);
      }
    } catch (error) {
      tests.databaseConnection = false;
      tests.errors.push(`Database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const allTestsPassed = tests.resendConnection && tests.databaseConnection;

    return NextResponse.json({
      success: allTestsPassed,
      timestamp: new Date().toISOString(),
      tests,
      configuration: {
        resendApiKey: process.env.RESEND_API_KEY ? '✓ Configured' : '✗ Missing',
        resendFromEmail: process.env.RESEND_FROM_EMAIL ? '✓ Configured' : '✗ Missing',
        databaseUrl: process.env.VECTOR_DATABASE_URL ? '✓ Configured' : '✗ Missing',
      },
      message: allTestsPassed 
        ? 'Email system is fully operational' 
        : 'Email system has configuration issues',
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Email system test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/test
 * Send a test email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, template = 'notification' } = body;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email address is required',
        },
        { status: 400 }
      );
    }

    // Prepare test data based on template
    let testData;
    switch (template) {
      case 'welcome':
        testData = {
          to: email,
          subject: '[TEST] Welcome to AI SaaS Platform!',
          template: 'welcome' as const,
          variables: {
            firstName: 'Test User',
            loginUrl: 'https://your-app.com/login',
          },
        };
        break;
      case 'password-reset':
        testData = {
          to: email,
          subject: '[TEST] Password Reset Request',
          template: 'password-reset' as const,
          variables: {
            firstName: 'Test User',
            resetUrl: 'https://your-app.com/reset-password?token=test123',
            expiryHours: 24,
          },
        };
        break;
      default:
        testData = {
          to: email,
          subject: '[TEST] Email System Test',
          template: 'notification' as const,
          variables: {
            title: 'Email System Test',
            message: 'This is a test email from your AI SaaS Platform. If you received this, the email system is working correctly!',
            actionUrl: 'https://your-app.com',
            actionText: 'Visit Platform',
          },
        };
    }

    // Send test email
    const result = await EmailService.sendEmail(testData);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
        sentTo: email,
        template: template,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send test email',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Test email failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}