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
 * On phones only the glyph and the line show — the dock already carries
 * New page, so a button there would be a second one.
 */
export function EmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph: EmptyGlyphName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyGlyph name={glyph} className="mb-2 max-md:size-20" />
        <EmptyTitle className="font-normal">{title}</EmptyTitle>
        {description && (
          <EmptyDescription className="max-md:hidden">{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {action && <EmptyContent className="max-md:hidden">{action}</EmptyContent>}
    </Empty>
  );
}
