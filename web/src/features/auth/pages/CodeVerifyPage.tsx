import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, CardBody } from '@heroui/react';
import { OTPInput } from '../components/OTPInput';
import { useVerifyOTP } from '../hooks/useVerifyOTP';
import { useSendOTP } from '../hooks/useSendOTP';

export function CodeVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOTP, isLoading, error, email } = useVerifyOTP();
  const { sendOTP, isLoading: isResending } = useSendOTP();
  const [otpCode, setOtpCode] = useState('');

  // Redirect to login if no email (must be in useEffect, not during render)
  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  const handleOTPComplete = async (code: string) => {
    setOtpCode(code);
    try {
      await verifyOTP(code);
      // If we get here, verification was successful
      const from = (location.state as { from?: string })?.from || '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      // Error is already set in state by useApiMutation, just catch to prevent unhandled rejection
    }
  };

  const handleResend = async () => {
    if (email) {
      await sendOTP(email);
    }
  };

  const handleBack = () => {
    navigate('/login');
  };

  if (!email) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-none">
        <CardBody className="flex flex-col gap-6">
          <div className="">
            <h1 className="text-2xl font-bold">Verificar código</h1>
            <p className="mt-2 text-gray-600">
              Ingresa el código de 6 dígitos enviado a <span className="font-semibold">{email}</span>
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}


          <OTPInput length={6} onComplete={handleOTPComplete} />

          <Button
            color="primary"
            size="lg"
            isLoading={isLoading}
            isDisabled={otpCode.length !== 6}
            onPress={() => handleOTPComplete(otpCode)}
            className="w-full"
          >
            Verificar código
          </Button>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {isResending ? 'Enviando...' : '¿No recibiste el código? Reenviar'}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="text-default-500 hover:underline"
            >
              Volver al inicio
            </button>
          </div>

        </CardBody>
      </Card>
    </div>
  );
}
