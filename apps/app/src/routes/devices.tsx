import { createFileRoute } from "@tanstack/react-router";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@rune/ui/components/empty";

export const Route = createFileRoute("/devices")({ component: DevicesView });

function DevicesView() {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-8 py-6">
        <h1 className="text-h1">Devices</h1>
        <div className="mt-8">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Local only</EmptyTitle>
              <EmptyDescription>
                Your notes live on this device. Pairing and sync between your devices lands here
                soon.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    </>
  );
}
