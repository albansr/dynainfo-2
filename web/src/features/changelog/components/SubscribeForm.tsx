import { useState, type FormEvent } from 'react';
import { Button, Input } from '@heroui/react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { APIError } from '@/core/api/client';
import { useSubscribeToChangelog } from '../hooks/useChangelog';
import { isValidEmail } from '../utils/changelogFormat';

function errorMessage(error: unknown): string {
  if (error instanceof APIError && error.status === 429) {
    return 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.';
  }
  return 'No hemos podido completar la suscripción. Revisa el correo y vuelve a intentarlo.';
}

/**
 * Public "recibe las novedades por correo" form. Single opt-in: posts the email
 * (the API checks Origin + honeypot + rate limit) and confirms inline. The hidden
 * `website` input is a honeypot — bots fill it, people never see it.
 */
export function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [showInvalid, setShowInvalid] = useState(false);
  const subscribe = useSubscribeToChangelog();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setShowInvalid(true);
      return;
    }
    subscribe.mutate({ email: email.trim(), website });
  };

  if (subscribe.isSuccess) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
        <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden />
        <span>Listo. Te avisaremos por correo de cada novedad. Puedes darte de baja cuando quieras.</span>
      </div>
    );
  }

  const invalidMessage = showInvalid ? 'Introduce un correo válido.' : undefined;
  const submitError = subscribe.isError ? errorMessage(subscribe.error) : undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          type="email"
          label="Tu correo"
          placeholder="tu@email.com"
          autoComplete="email"
          value={email}
          onValueChange={(value) => {
            setEmail(value);
            setShowInvalid(false);
          }}
          isInvalid={Boolean(invalidMessage ?? submitError)}
          errorMessage={invalidMessage ?? submitError}
          className="flex-1"
        />
        {/* Honeypot: off-screen, out of the tab order and hidden from assistive tech */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          className="hidden"
        />
        <Button
          type="submit"
          color="primary"
          className="h-14 cursor-pointer sm:w-40"
          isLoading={subscribe.isPending}
        >
          Suscribirme
        </Button>
      </div>
      <p className="text-xs text-default-500">
        Solo novedades de DynaInfo. Sin spam y con baja en un clic.
      </p>
    </form>
  );
}
