import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@rune/ui/components/dialog";

import { parsePairInput } from "@/lib/sync/pair-link";

/** In-app camera scanner for a pairing QR code shown on another device. */
export function QrScanDialog({
  open,
  onOpenChange,
  onSecret,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSecret: (secret: Uint8Array) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Keep the latest callbacks without re-running the effect below on every
  // render — devices.tsx passes onSecret/onOpenChange as fresh closures each
  // time, and re-running the effect would tear down and restart the camera.
  const onSecretRef = useRef(onSecret);
  const onOpenChangeRef = useRef(onOpenChange);
  onSecretRef.current = onSecret;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let scanner: QrScanner | null = null;
    setMessage(null);

    void QrScanner.hasCamera().then((hasCamera) => {
      if (cancelled) return;
      if (!hasCamera) {
        setMessage("No camera found on this device.");
        return;
      }

      scanner = new QrScanner(
        video,
        ({ data }) => {
          const result = parsePairInput(data);
          if (result.isOk()) {
            scanner?.stop();
            onSecretRef.current(result.value);
            onOpenChangeRef.current(false);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          preferredCamera: "environment",
        },
      );

      scanner.start().catch(() => {
        if (!cancelled) {
          setMessage("Camera access was denied. Allow it in your browser settings and try again.");
        }
      });
    });

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan pairing code</DialogTitle>
          <DialogDescription>Point the camera at the QR on your other device.</DialogDescription>
        </DialogHeader>
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-square w-full rounded-2xl bg-muted object-cover"
        />
        {message && <span className="text-destructive text-small">{message}</span>}
      </DialogContent>
    </Dialog>
  );
}
