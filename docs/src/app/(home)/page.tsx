import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 gap-4">
      <p className="text-sm uppercase tracking-[0.2em] text-fd-muted-foreground">riblt workspace</p>
      <h1 className="text-4xl font-bold">Set reconciliation docs for riblt and set-sync</h1>
      <p className="text-fd-muted-foreground max-w-2xl mx-auto">
        Learn the low-level RIBLT engine and the higher-level browser/server protocol built on top of it.
      </p>
      <p>
        Open{' '}
        <Link href="/docs" className="font-medium underline">
          /docs
        </Link>{' '}
        to read the package documentation.
      </p>
    </div>
  );
}
