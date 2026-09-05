import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { onViewportChange } from "@/lib/viewport";

export const Route = createFileRoute("/viewport")({
  head: () => ({ meta: [{ title: "Viewport — Rune" }] }),
  component: ViewportProbe,
});

/**
 * Diagnostic page: every way the platform measures the viewport, live, plus
 * three bottom markers anchored three different ways. After reproducing the
 * "dock floats above the bottom" state, a screenshot of this page says which
 * measurement is wrong. Not linked from anywhere; open /viewport by hand.
 */
function ViewportProbe() {
  const [rows, setRows] = useState<[string, string][]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const px = (unit: string) => {
      const el = document.getElementById(`probe-${unit}`);
      return el ? `${el.getBoundingClientRect().height.toFixed(1)}` : "?";
    };
    const read = () => {
      const vv = window.visualViewport;
      setRows([
        ["standalone", String(window.matchMedia("(display-mode: standalone)").matches)],
        ["screen.height", String(window.screen.height)],
        ["outerHeight", String(window.outerHeight)],
        ["innerHeight", String(window.innerHeight)],
        ["html.clientHeight", String(document.documentElement.clientHeight)],
        ["body.scrollHeight", String(document.body.scrollHeight)],
        ["scrollY", String(window.scrollY)],
        ["vv.height", vv ? vv.height.toFixed(1) : "n/a"],
        ["vv.offsetTop", vv ? vv.offsetTop.toFixed(1) : "n/a"],
        ["vv.scale", vv ? vv.scale.toFixed(3) : "n/a"],
        ["100vh", px("vh")],
        ["100svh", px("svh")],
        ["100lvh", px("lvh")],
        ["100dvh", px("dvh")],
        ["safe-area-bottom", getComputedStyle(document.getElementById("probe-sab")!).height],
        ["time", new Date().toLocaleTimeString()],
      ]);
      setTick((t) => t + 1);
    };
    read();
    const stop = onViewportChange(read);
    const interval = window.setInterval(read, 1000);
    return () => {
      stop();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-background p-4 font-mono text-sm">
      <div className="mb-3 text-muted-foreground">viewport probe · updates {tick}</div>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="pr-4 text-muted-foreground">{k}</td>
              <td className="tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* invisible unit probes */}
      <div
        id="probe-vh"
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: "100vh" }}
      />
      <div
        id="probe-svh"
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: "100svh" }}
      />
      <div
        id="probe-lvh"
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: "100lvh" }}
      />
      <div
        id="probe-dvh"
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: "100dvh" }}
      />
      <div
        id="probe-sab"
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: "env(safe-area-inset-bottom)" }}
      />
      {/* three ways to anchor the bottom */}
      <div className="fixed inset-x-0 bottom-0 h-1.5 bg-red-500" title="fixed bottom:0" />
      <div
        className="fixed inset-x-0 h-1.5 bg-green-500"
        style={{ top: "calc(100svh - 12px)" }}
        title="top from 100svh"
      />
      <div
        className="fixed inset-x-0 h-1.5 bg-blue-500"
        style={{ top: "calc(100dvh - 18px)" }}
        title="top from 100dvh"
      />
      <div className="fixed inset-x-0 bottom-6 text-center text-[11px] text-muted-foreground">
        red = fixed bottom:0 · green = 100svh · blue = 100dvh
      </div>
    </div>
  );
}
