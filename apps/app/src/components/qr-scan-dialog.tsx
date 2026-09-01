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
  // Callback ref → state: the dialog mounts its children a render after
  // `open` flips, so an effect keyed on `open` alone sees no <video> yet.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Keep the latest callbacks without restarting the camera on every render.
  const onSecretRef = useRef(onSecret);
  const onOpenChangeRef = useRef(onOpenChange);
  onSecretRef.current = onSecret;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open || !video) return;

    let cancelled = false;
    setMessage(null);

    const scanner = new QrScanner(
      video,
      ({ data }) => {
        const result = parsePairInput(data);
        if (result.isOk()) {
          scanner.stop();
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

    // Belt and braces for codes shown on dark screens.
    scanner.setInversionMode("both");
    scanner.start().catch((error: unknown) => {
      if (cancelled) return;
      console.warn("qr-scan: camera failed to start", error);
      const name = error instanceof Error ? error.name : "";
      setMessage(
        name === "NotAllowedError"
          ? "Camera access was denied. Allow it in your browser settings and try again."
          : name === "NotFoundError"
            ? "No camera found on this device."
            : `Camera failed to start${name ? ` (${name})` : ""}. Reload and try again.`,
      );
    });

    return () => {
      cancelled = true;
      scanner.stop();
      scanner.destroy();
    };
  }, [open, video]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan pairing code</DialogTitle>
          <DialogDescription>Point the camera at the QR on your other device.</DialogDescription>
        </DialogHeader>
        <video
          ref={setVideo}
          playsInline
          muted
          className="aspect-square w-full rounded-2xl bg-muted object-cover"
        />
        {message && <span className="text-destructive text-small">{message}</span>}
      </DialogContent>
    </Dialog>
  );
}
