import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-h1 font-medium tracking-tight">Private notes that sync without a server.</h1>
      <p className="max-w-[48ch] text-muted-foreground">
        Rune keeps every page on your own devices and syncs them to each other directly. No
        account, no cloud, nothing to trust.
      </p>
      <Link href="/docs" className="underline underline-offset-4">
        Read the docs
      </Link>
    </div>
  );
}
