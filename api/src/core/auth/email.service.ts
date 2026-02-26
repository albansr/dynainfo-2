import { Resend } from 'resend';
import { logger } from '../logger/logger.js';

/**
 * Email service for OTP delivery via Resend
 *
 * Uses Resend's default domain (onboarding@resend.dev) for development
 * Configure RESEND_API_KEY in .env
 */
const resend = new Resend(process.env['RESEND_API_KEY']);

/**
 * Send OTP code via email
 *
 * @param email - Recipient email address
 * @param code - 6-digit OTP code
 */
export async function sendOTPEmail(
  email: string,
  code: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'DynaInfo <no-reply@aionsales.app>',
      to: email,
      subject: `Your verification code: ${code}`,
      html: getOTPEmailTemplate(code),
    });
  } catch (error) {
    logger.error({
      type: 'email_error',
      err: error,
      email,
    }, 'Failed to send OTP email');
    throw new Error('Failed to send verification email');
  }
}

/**
 * HTML email template for OTP code
 *
 * Simple, clean design with emphasis on the code
 */
function getOTPEmailTemplate(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">DynaInfo</h1>
        </div>

        <div style="background: #f9fafb; padding: 40px 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin-top: 0;">Your verification code</h2>
          <p style="color: #6b7280; font-size: 16px;">Enter this code to complete your sign-in:</p>

          <div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 2px solid #333;">
            <div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #333; font-family: 'Courier New', monospace;">
              ${code}
            </div>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
            This code will expire in <strong>10 minutes</strong>.
          </p>

          <p style="color: #9ca3af; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
}
