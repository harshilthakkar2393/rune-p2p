/** Filled folder glyph (Resurf-style solid folders); tinted via `color`. */
export function FolderGlyph({ color, className }: { color?: string; className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      className={className}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M2.25 6.6c0-1.44 1.14-2.6 2.55-2.6h4.55c.66 0 1.3.27 1.77.74l1.22 1.24c.42.43.99.67 1.59.67h6.32c1.41 0 2.55 1.16 2.55 2.6v8.15c0 1.44-1.14 2.6-2.55 2.6H4.8c-1.41 0-2.55-1.16-2.55-2.6V6.6z"
      />
    </svg>
  );
}
