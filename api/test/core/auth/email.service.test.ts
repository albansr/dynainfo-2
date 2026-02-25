import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendOTPEmail } from '../../../src/core/auth/email.service.js';

// Mock Resend with function factory to avoid hoisting issues
vi.mock('resend', () => {
  const mockSendFn = vi.fn().mockResolvedValue({ id: 'mock-email-id' });
  return {
    Resend: class {
      emails = {
        send: mockSendFn,
      };
    },
    getMockSend: () => mockSendFn,
  };
});

const { getMockSend } = await import('resend');
const mockSend = (getMockSend as any)();

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendOTPEmail', () => {
    it('should send OTP email successfully', async () => {
      await expect(
        sendOTPEmail('user@example.com', '123456')
      ).resolves.not.toThrow();
    });

    it('should include correct email metadata', async () => {
      await sendOTPEmail('test@example.com', '654321');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'DynaInfo <onboarding@resend.dev>',
          to: 'test@example.com',
          subject: 'Your verification code: 654321',
          html: expect.stringContaining('654321'),
        })
      );
    });

    it('should include OTP code in HTML template', async () => {
      const code = '999888';
      await sendOTPEmail('user@test.com', code);

      const htmlArg = mockSend.mock.calls[0][0].html;
      expect(htmlArg).toContain(code);
      expect(htmlArg).toContain('DynaInfo');
      expect(htmlArg).toContain('10 minutes');
    });

    it('should throw error when email send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        sendOTPEmail('fail@example.com', '123456')
      ).rejects.toThrow('Failed to send verification email');
    });
  });
});
