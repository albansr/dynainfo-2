import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Input, Card, CardBody } from '@heroui/react';
import { useSendOTP } from '../hooks/useSendOTP';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOTP, isLoading, error, success } = useSendOTP();

  useEffect(() => {
    if (success) {
      // Pass along the returnUrl (from) to code-verify page
      navigate('/code-verify', { state: location.state });
    }
  }, [success, navigate, location.state]);

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      return;
    }
    await sendOTP(email);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-none">
        <CardBody className="gap-6">
          <div className="">
            <img src="/brand.png" alt="DynaInfo" className="w-[95px] h-auto mb-4" />
            <p className="mt-2 text-gray-600">
              Ingresa tu email para recibir un código de verificación
            </p>
          </div>

          <div className="space-y-4">
            <Input
              label="Email"
              placeholder="tu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendOTP();
                }
              }}
              isInvalid={!!error}
              errorMessage={error}
            />

            <Button
              color="primary"
              className="w-full h-12"
              onPress={handleSendOTP}
              isLoading={isLoading}
              isDisabled={!email || !email.includes('@')
              }
            >
              Enviar Código
            </Button>
          </div>
        </CardBody>
      </Card>
    </div >
  );
}
