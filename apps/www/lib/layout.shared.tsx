import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Rune">
      <span className="rune">ᚱ</span>une
    </span>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
    },
  };
}
