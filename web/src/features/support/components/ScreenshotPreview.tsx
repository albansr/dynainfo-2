import { useEffect, useMemo } from 'react';
import { Modal, ModalBody, ModalContent, ModalHeader, Skeleton, useDisclosure } from '@heroui/react';
import { useSupportScreenshot } from '../hooks/useSupport';

/** Screenshot thumbnail; opens full size in a modal. Fetched with the session (it can show customer data). */
export function ScreenshotPreview({ number }: { number: number }) {
  const { data: blob, isLoading, isError } = useSupportScreenshot(number, true);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (isError || !url) return <p className="text-sm text-default-500">No pudimos cargar la captura.</p>;

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-pointer overflow-hidden rounded-lg border border-default-200"
        aria-label="Ver la captura de pantalla a tamaño completo"
      >
        <img src={url} alt="Captura de pantalla de la solicitud" className="h-auto w-full" />
      </button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Captura de pantalla</ModalHeader>
          <ModalBody className="pb-6">
            <img src={url} alt="Captura de pantalla de la solicitud" className="h-auto w-full rounded-lg" />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
