import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@rune/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rune/ui/components/card";
import { ScrollArea } from "@rune/ui/components/scroll-area";

import { pairWithSecret } from "@/lib/sync/manager";
import { parsePairInput } from "@/lib/sync/pair-link";
import { useSyncStatus } from "@/lib/sync/status";

export const Route = createFileRoute("/pair")({ component: PairView });

function PairView() {
  const navigate = useNavigate();
  const status = useSyncStatus();
  const [secret] = useState(() => {
    const result = parsePairInput(window.location.hash);
    return result.isOk() ? result.value : null;
  });
  const [pairing, setPairing] = useState(false);

  const goToDevices = () => void navigate({ to: "/devices" });

  const handlePair = () => {
    if (!secret) return;
    setPairing(true);
    void pairWithSecret(secret).then(() => navigate({ to: "/devices" }));
  };

  return (
    <ScrollArea className="h-full min-h-0">
      <main className="mx-auto w-full max-w-2xl px-4 md:px-8 pt-3 pb-6">
        <h1 className="text-h1">Pair this device</h1>

        {secret ? (
          <Card className="mt-8 p-6">
            <CardHeader className="px-0">
              <CardTitle className="text-h3">Ready to pair</CardTitle>
              <CardDescription>
                {status.paired
                  ? "This device is already paired. Pairing again replaces that."
                  : "Sync notes across your devices — no account, no server."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 px-0">
              <Button onClick={handlePair} disabled={pairing}>
                Pair this device
              </Button>
              <Button variant="ghost" onClick={goToDevices}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8 p-6">
            <CardHeader className="px-0">
              <CardTitle className="text-h3">This link isn't a pairing code.</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Button onClick={goToDevices}>Go to Devices</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </ScrollArea>
  );
}
