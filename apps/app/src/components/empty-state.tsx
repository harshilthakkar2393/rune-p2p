import type { ReactNode } from "react";

import { EmptyGlyph, type EmptyGlyphName } from "@/components/empty-glyph";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@rune/ui/components/empty";

/**
 * Empty-state grammar (Linear's): glyph, one line, at most one action.
 * Places are glyphed; transient states (a filter that hides everything) are
 * text only — pass no glyph. The block sits at Linear's height: its centre
 * lands around 44% of the pane, so the min-height and bottom padding are
 * what put it there, not the parent.
 * On phones only the glyph and the line show — the dock already carries
 * New page, so a button there would be a second one.
 */
export function EmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph?: EmptyGlyphName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-[60svh] pb-[8svh] md:min-h-[66svh]">
      <EmptyHeader>
        {glyph && <EmptyGlyph name={glyph} className="mb-2 max-md:h-[96px] max-md:w-[112px]" />}
        <EmptyTitle className="font-normal">{title}</EmptyTitle>
        {description && (
          <EmptyDescription className="max-md:hidden">{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {action && <EmptyContent className="max-md:hidden">{action}</EmptyContent>}
    </Empty>
  );
}
