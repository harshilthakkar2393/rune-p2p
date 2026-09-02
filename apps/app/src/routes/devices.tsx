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

import { PairQr } from "@/components/pair-qr";
import { QrScanDialog } from "@/components/qr-scan-dialog";
import { useNodes } from "@/hooks/use-index";
import { getDeviceName } from "@/lib/device";
import { pairWithSecret, unpair } from "@/lib/sync/manager";
import { buildPairLink, parsePairInput } from "@/lib/sync/pair-link";
import { generateSecret, readStoredSecret, secretToPhrase } from "@/lib/sync/secret";
import { useSyncStatus } from "@/lib/sync/status";
import type { Page } from "@/lib/schema";

export const Route = createFileRoute("/devices")({
  head: () => ({ meta: [{ title: "Devices — Rune" }] }),
  component: DevicesView,
});

function DevicesView() {
  const status = useSyncStatus();
  const nodes = useNodes();
  const [phraseInput, setPhraseInput] = useState("");
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<Uint8Array | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const handleCreate = () => {
    const secret = generateSecret();
    setRevealedSecret(secret);
    void pairWithSecret(secret);
  };

  const handlePairSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = parsePairInput(phraseInput);
    if (result.isErr()) {
      setPhraseError(result.error.message);
      return;
    }
    setPhraseError(null);
    setPhraseInput("");
    void pairWithSecret(result.value);
  };

  const handleScannedSecret = (secret: Uint8Array) => {
    void pairWithSecret(secret);
  };

  const handleShowPhrase = () => {
    const secret = readStoredSecret();
    if (secret) setRevealedSecret(secret);
  };

  const handleCopy = () => {
    if (!revealedSecret) return;
    void navigator.clipboard.writeText(secretToPhrase(revealedSecret));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyLink = () => {
    if (!revealedSecret) return;
    void navigator.clipboard.writeText(buildPairLink(revealedSecret, window.location.origin));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  const handleUnpair = () => {
    unpair();
    setRevealedSecret(null);
    setConfirmUnpair(false);
  };

  return (
    <ScrollArea className="h-full min-h-0">
      <main className="mx-auto w-full max-w-2xl px-4 md:px-8 pt-3 pb-6">
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
                    placeholder="twelve words or a pairing link"
                    value={phraseInput}
                    onChange={(event) => setPhraseInput(event.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    Pair
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
                    Scan
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
                {status.peers.map((peer) => {
                  const page = peer.pageId
                    ? nodes.find(
                        (node): node is Page => node.id === peer.pageId && node.type === "page",
                      )
                    : undefined;
                  return (
                    <div key={peer.deviceId} className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      <span className="text-sm">{peer.name}</span>
                      {peer.pageId === null ? (
                        <span className="text-small text-muted-foreground">online</span>
                      ) : page ? (
                        <span className="text-small text-muted-foreground">
                          editing{" "}
                          <span className="text-foreground">{page.title || "Untitled"}</span>
                        </span>
                      ) : (
                        <span className="text-small text-muted-foreground">editing</span>
                      )}
                    </div>
                  );
                })}
                <span className="font-mono text-tiny text-muted-foreground">
                  {status.reconnecting
                    ? "reconnecting…"
                    : status.connected
                      ? "connected"
                      : "looking for your devices…"}
                  {status.pendingDocs > 0 ? ` · syncing ${status.pendingDocs}` : ""}
                </span>
                {status.error && (
                  <span className="text-destructive text-small">{status.error}</span>
                )}
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardContent className="flex flex-col gap-3 px-0">
                {revealedSecret ? (
                  <>
                    <PairQr secret={revealedSecret} />
                    <div className="grid grid-cols-3 gap-x-5 gap-y-1.5 rounded-2xl border bg-muted/40 p-3 font-mono text-small tabular-nums">
                      {secretToPhrase(revealedSecret)
                        .split(" ")
                        .map((word, index) => (
                          <span key={word + index}>
                            <span className="text-muted-foreground">{index + 1}. </span>
                            {word}
                          </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCopyLink}>
                        {linkCopied ? "Copied" : "Copy link"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button variant="outline" className="self-start" onClick={handleShowPhrase}>
                    Show pairing code
                  </Button>
                )}
              </CardContent>
            </Card>

            <Button
              variant="destructive"
              className="self-start"
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
              <AlertDialogAction variant="destructive" onClick={handleUnpair}>
                Unpair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <QrScanDialog open={scanOpen} onOpenChange={setScanOpen} onSecret={handleScannedSecret} />
      </main>
    </ScrollArea>
  );
}
