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
        d="M3 7.2c0-1.2.95-2.2 2.13-2.2h3.9c.56 0 1.1.23 1.5.63l1.05 1.07c.4.4.94.63 1.5.63h5.79c1.18 0 2.13.98 2.13 2.2v7.27c0 1.21-.95 2.2-2.13 2.2H5.13C3.95 19 3 18.01 3 16.8V7.2z"
      />
    </svg>
  );
}
