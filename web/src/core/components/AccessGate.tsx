import { useState, type ReactNode } from 'react';
import { Button, Input } from '@heroui/react';

interface AccessGateProps {
  /** Code that unlocks the content; null disables the gate (children render directly). */
  accessCode: string | null;
  /** localStorage key remembering an unlocked browser. */
  storageKey: string;
  /** Optional announcement shown above the code form while locked. */
  lockedContent?: ReactNode;
  children: ReactNode;
}

/**
 * Validation-phase gate for features under review: while `accessCode` is set,
 * visitors see `lockedContent` plus a discreet code form, and only whoever
 * types the code reaches `children` (remembered per browser). Frontend-only —
 * it hides UI during a validation window, it is NOT security. Setting the code
 * to null opens the feature to everyone. First used to gate the Festival
 * Virtual 2 dashboard before its launch.
 */
export function AccessGate({ accessCode, storageKey, lockedContent, children }: AccessGateProps) {
  const [unlocked, setUnlocked] = useState(
    () => accessCode === null || localStorage.getItem(storageKey) === accessCode
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) {
    return <>{children}</>;
  }

  const submit = () => {
    if (code.trim() === accessCode) {
      localStorage.setItem(storageKey, code.trim());
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
      {lockedContent}

      <div className="mt-12 w-full max-w-xs">
        <p className="text-xs text-zinc-400 mb-3">¿Tienes un código de acceso?</p>
        <div className="flex gap-2">
          <Input
            aria-label="Código de acceso"
            type="password"
            size="sm"
            placeholder="Código de acceso"
            value={code}
            isInvalid={error}
            errorMessage={error ? 'Código incorrecto' : undefined}
            onValueChange={(v) => {
              setCode(v);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <Button size="sm" color="primary" onPress={submit}>
            Acceder
          </Button>
        </div>
      </div>
    </div>
  );
}
