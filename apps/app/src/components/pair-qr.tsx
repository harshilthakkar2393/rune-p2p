import { useMemo } from "react";
import { correction, generate } from "lean-qr";
import { toSvgSource } from "lean-qr/extras/svg";
import { cn } from "@rune/ui/lib/utils";

import { buildPairLink } from "@/lib/sync/pair-link";

/** Renders this device's pairing secret as a scannable QR code. */
export function PairQr({ secret, className }: { secret: Uint8Array; className?: string }) {
  const svg = useMemo(() => {
    const link = buildPairLink(secret, window.location.origin);
    return toSvgSource(generate(link, { minCorrectionLevel: correction.M }), {
      on: "currentColor",
      off: "transparent",
      pad: 2,
      xmlDeclaration: false,
    });
  }, [secret]);

  return (
    <div
      className={cn("aspect-square w-44 text-foreground [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Pairing QR code"
      role="img"
    />
  );
}
