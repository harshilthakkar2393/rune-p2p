import type { ReactElement, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@rune/ui/components/tooltip";

/** Tooltip around an icon-only control. `children` becomes the trigger via
 * Base UI's `render`, so it composes with other render-prop triggers:
 *   <DropdownMenu><Tip label="Filter"><DropdownMenuTrigger render={<Button/>}/></Tip>…
 * Keep `aria-label` on the control; the tooltip is the sighted equivalent. */
export function Tip({ label, children }: { label: ReactNode; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
