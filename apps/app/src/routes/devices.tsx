import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@rune/ui/components/alert-dialog";
import { Badge } from "@rune/ui/components/badge";
import { Button } from "@rune/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rune/ui/components/card";
import { Input } from "@rune/ui/components/input";
import { ScrollArea } from "@rune/ui/components/scroll-area";

import { getDeviceName } from "@/lib/device";
import { pairWithSecret, unpair } from "@/lib/sync/manager";
import {
  generateSecret,
  phraseToSecret,
  readStoredSecret,
  secretToPhrase,
} from "@/lib/sync/secret";
import { useSyncStatus } from "@/lib/sync/status";

export const Route = createFileRoute("/devices")({ component: DevicesView });

function DevicesView() {
  const status = useSyncStatus();
  const [phraseInput, setPhraseInput] = useState("");
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [revealedPhrase, setRevealedPhrase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);

  const handleCreate = () => {
    const secret = generateSecret();
    setRevealedPhrase(secretToPhrase(secret));
    void pairWithSecret(secret);
  };

  const handlePairSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = phraseToSecret(phraseInput);
    if (result.isErr()) {
      setPhraseError(result.error.message);
      return;
    }
    setPhraseError(null);
    setPhraseInput("");
    void pairWithSecret(result.value);
  };

  const handleShowPhrase = () => {
    const secret = readStoredSecret();
    if (secret) setRevealedPhrase(secretToPhrase(secret));
  };

  const handleCopy = () => {
    if (!revealedPhrase) return;
    void navigator.clipboard.writeText(revealedPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleUnpair = () => {
    unpair();
    setRevealedPhrase(null);
    setConfirmUnpair(false);
  };

  return (
    <ScrollArea className="h-full min-h-0">
      <main className="mx-auto w-full max-w-2xl px-8 pt-3 pb-6">
        <h1 className="text-h1">Devices</h1>

        {!status.paired ? (
          <Card className="mt-8 p-6">
            <CardHeader className="px-0">
              <CardTitle className="text-h3">Pair your devices</CardTitle>
              <CardDescription>
                Sync notes across your devices — no account, no server.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-0">
              <Button onClick={handleCreate} className="self-start">
                Create pairing code
              </Button>

              <div className="flex flex-col gap-1.5">
                <span className="text-small text-muted-foreground">Have a code?</span>
                <form onSubmit={handlePairSubmit} className="flex gap-2">
                  <Input
                    placeholder="twelve words"
                    value={phraseInput}
                    onChange={(event) => setPhraseInput(event.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    Pair
                  </Button>
                </form>
                {phraseError && <span className="text-destructive text-small">{phraseError}</span>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 flex flex-col gap-4">
            <Card className="p-6">
              <CardContent className="flex flex-col gap-3 px-0">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-foreground" />
                  <span className="text-sm">{getDeviceName()}</span>
                  <Badge variant="secondary">this device</Badge>
                </div>
                {status.peers.map((peer) => (
                  <div key={peer.deviceId} className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="text-sm">{peer.name}</span>
                    <span className="text-small text-muted-foreground">
                      {peer.pageId ? "editing" : "online"}
                    </span>
                  </div>
                ))}
                <span className="font-mono text-tiny text-muted-foreground">
                  {status.connected ? "connected" : "connecting…"}
                  {status.pendingDocs > 0 ? ` · syncing ${status.pendingDocs}` : ""}
                </span>
                {status.error && (
                  <span className="text-destructive text-small">{status.error}</span>
                )}
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardContent className="flex flex-col gap-3 px-0">
                {revealedPhrase ? (
                  <>
                    <div className="rounded-2xl border bg-muted/40 p-3 font-mono text-small">
                      {revealedPhrase}
                    </div>
                    <Button variant="outline" size="sm" className="self-start" onClick={handleCopy}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" className="self-start" onClick={handleShowPhrase}>
                    Show pairing code
                  </Button>
                )}
              </CardContent>
            </Card>

            <Button
              variant="ghost"
              className="self-start text-destructive hover:text-destructive"
              onClick={() => setConfirmUnpair(true)}
            >
              Unpair this device
            </Button>
          </div>
        )}

        <AlertDialog
          open={confirmUnpair}
          onOpenChange={(open) => {
            if (!open) setConfirmUnpair(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unpair this device?</AlertDialogTitle>
              <AlertDialogDescription>
                Notes stay on this device. It just stops syncing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnpair}>Unpair</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </ScrollArea>
  );
}
