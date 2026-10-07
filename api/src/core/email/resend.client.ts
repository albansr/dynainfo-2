import { Resend } from 'resend';

/**
 * Shared Resend client and sender identity for every outgoing email
 * (sign-in OTP, Novedades digest). Configure RESEND_API_KEY in .env.
 */
export const resend = new Resend(process.env['RESEND_API_KEY']);

export const EMAIL_FROM = 'DynaInfo <no-reply@aionsales.app>';
