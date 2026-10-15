import { useState } from 'react';
import { Button, Textarea } from '@heroui/react';
import { toast } from 'sonner';
import { DESCRIPTION_MAX } from '../config/support';
import { useTicketFeedback } from '../hooks/useSupport';

interface FeedbackCardProps {
  number: number;
  /** From the resolved email's buttons (?feedback=…): highlights the card and pre-selects the answer. */
  suggested: 'solved' | 'not_solved' | null;
}

/** "¿Se solucionó?" on a resolved request: closes it, or reopens it with an optional comment. */
export function FeedbackCard({ number, suggested }: FeedbackCardProps) {
  const feedback = useTicketFeedback(number);
  const [reopening, setReopening] = useState(suggested === 'not_solved');
  const [comment, setComment] = useState('');

  const answer = (solved: boolean) =>
    feedback.mutate(
      { solved, ...(comment.trim() && !solved ? { body: comment.trim() } : {}) },
      {
        onSuccess: () => toast.success(solved ? 'Gracias. Hemos cerrado la solicitud.' : 'La hemos reabierto. El equipo lo revisará.'),
        onError: () => toast.error('No pudimos guardar tu respuesta. Inténtalo de nuevo.'),
      },
    );

  return (
    <section
      aria-label="¿Se solucionó?"
      className={`rounded-xl border p-4 ${suggested ? 'border-primary bg-primary-50' : 'border-default-200 bg-default-50'}`}
    >
      <h2 className="text-sm font-semibold text-foreground">¿Se solucionó?</h2>
      {reopening ? (
        <div className="mt-3 flex flex-col gap-3">
          <Textarea
            aria-label="Qué sigue pasando"
            variant="bordered"
            minRows={2}
            maxLength={DESCRIPTION_MAX}
            placeholder="Cuéntanos qué sigue pasando (opcional)"
            value={comment}
            onValueChange={setComment}
          />
          <div className="flex flex-wrap gap-2">
            <Button color="primary" className="cursor-pointer" isLoading={feedback.isPending} onPress={() => answer(false)}>
              Reabrir la solicitud
            </Button>
            <Button variant="light" className="cursor-pointer" onPress={() => setReopening(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            color="primary"
            className="cursor-pointer"
            isLoading={feedback.isPending}
            onPress={() => answer(true)}
          >
            Sí, cerrar
          </Button>
          <Button variant="bordered" className="cursor-pointer" onPress={() => setReopening(true)}>
            Sigue pasando
          </Button>
        </div>
      )}
    </section>
  );
}
