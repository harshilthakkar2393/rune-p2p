/**
 * Source of truth for the empty-state glyphs. Regenerate with
 *   node apps/app/scripts/empty-glyphs.mjs > apps/app/src/components/empty-glyph.tsx
 *   cd apps/app && bunx oxfmt src/components/empty-glyph.tsx
 * and never hand-edit the output; empty-glyph.test.ts checks it matches.
 *
 * Construction (measured from Linear's Inbox/Drafts/Projects, round 5):
 * one object per state, derived from the section's sidebar icon; 1.5px stroke;
 * a 4px slab thickness drawn as a second contour; corners ≈ width / 9;
 * containers frontal three-quarter, units on a 30° grid; echoes only for stacks.
 * Coordinates are CSS px in a 140×120 box centred at 0,0.
 */

const C = Math.cos(Math.PI / 6);
const S = 0.5;
const FILL = "fill";
const SOFT = "soft";

const proj = ([x, y, z]) => [(x - y) * C, (x + y) * S - z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];

/* ---- tiny element tree ---- */
const el = (tag, attrs = {}, children = []) => ({ tag, attrs, children });
const g = (attrs = {}) => el("g", attrs);
const put = (parent, child) => {
  parent.children.push(child);
  return child;
};

/* ---- projector ---- */
function facePts(O, U, V, w, d, r, n = 7) {
  const pts = [];
  const corners = [
    [w - r, r, -Math.PI / 2, 0],
    [w - r, d - r, 0, Math.PI / 2],
    [r, d - r, Math.PI / 2, Math.PI],
    [r, r, Math.PI, 1.5 * Math.PI],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const u = cx + r * Math.cos(a);
      const v = cy + r * Math.sin(a);
      pts.push(proj(add(add(O, mul(U, u)), mul(V, v))));
    }
  }
  return pts;
}
function hull(input) {
  const pts = [...input].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  const up = [];
  for (const p of pts) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of pts.reverse()) {
    while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const d = (pts, close = true) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + (close ? " Z" : "");
const path = (pts, line = FILL) => el("path", { d: d(pts), line });

/** rounded rect at O spanning U·w × V·d, extruded along N by t */
function slab(parent, O, U, V, N, w, d_, r, t) {
  const f0 = facePts(O, U, V, w, d_, r);
  const f1 = facePts(add(O, mul(N, t)), U, V, w, d_, r);
  const facing = N[0] + N[1] + N[2] > 0;
  put(parent, path(hull(f0.concat(f1))));
  put(parent, path(facing ? f1 : f0));
}
const ground = (p, x, y, z, w, d_, r, t) => slab(p, [x, y, z], X, Y, Z, w, d_, r, t);

/* frontal helpers */
const rimRect = (cx, cy, w, h, rx, ry, line = FILL) =>
  el("rect", { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx, ry, line });
function container(parent, { w = 92, h = 80, rim = 24, taper = 6, rb = 9, inset = 4 }) {
  const top = -h / 2;
  const rimCy = top + rim / 2;
  const bw = w / 2;
  const bl = -bw + taper;
  const br = bw - taper;
  const bot = h / 2;
  put(parent, el("path", {
    d: `M${-bw} ${rimCy} L${bl} ${bot - rb} Q${bl} ${bot} ${bl + rb} ${bot} L${br - rb} ${bot} Q${br} ${bot} ${br} ${bot - rb} L${bw} ${rimCy}`,
    line: FILL,
  }));
  put(parent, rimRect(0, rimCy, w, rim, w * 0.13, rim * 0.5));
  put(parent, rimRect(0, rimCy, w - inset * 2, rim - inset * 2, (w - inset * 2) * 0.13, (rim - inset * 2) * 0.5));
  const iw = (w - inset * 2) / 2;
  const fy = rimCy + rim / 2 - inset;
  put(parent, el("path", { d: `M${-iw + 6} ${fy - 3} Q0 ${fy + 3} ${iw - 6} ${fy - 3}`, line: SOFT }));
}
function pencil(parent, x, y, len = 70, ang = -50, w = 10) {
  const p = put(parent, g({ transform: `translate(${x} ${y}) rotate(${ang})` }));
  put(p, el("path", { d: `M0 0 L14 ${-w / 2} L${len} ${-w / 2} L${len} ${w / 2} L14 ${w / 2} Z`, line: FILL }));
  put(p, el("path", { d: `M14 ${-w / 2} L14 ${w / 2} M5 ${-w / 6} L5 ${w / 6} M${len - 6} ${-w / 2} L${len - 6} ${w / 2}` }));
}

/* ---- the chosen glyphs (round 5: Home B, Library B, Trash B, Folder A, Devices B) ---- */
const GLYPHS = {
  /** Home: three sheets and a pencil — the New page icon, physical (Drafts sibling). */
  home() {
    const root = g();
    const e2 = put(root, g({ transform: "translate(0 24)", opacity: 0.15 }));
    ground(e2, -42, -36, 0, 84, 72, 8, 3);
    const e1 = put(root, g({ transform: "translate(0 13)", opacity: 0.35 }));
    ground(e1, -42, -36, 0, 84, 72, 8, 3);
    const s = put(root, g({ transform: "translate(0 2)" }));
    ground(s, -42, -36, 0, 84, 72, 8, 3);
    pencil(root, -6, 2);
    return root;
  },
  /** Library: a stack of tiles, top one lifted — the grid icon as a pile (Views sibling). */
  pages() {
    const root = g({ transform: "translate(0 10)" });
    const w = 62;
    const dd = 56;
    const e2 = put(root, g({ transform: "translate(0 18)", opacity: 0.15 }));
    ground(e2, -w / 2, -dd / 2, 0, w, dd, 7, 4);
    const e1 = put(root, g({ transform: "translate(0 9)", opacity: 0.35 }));
    ground(e1, -w / 2, -dd / 2, 0, w, dd, 7, 4);
    ground(root, -w / 2, -dd / 2, 0, w, dd, 7, 4);
    const lift = put(root, g({ transform: "translate(10 -26) rotate(-12)" }));
    ground(lift, -w / 2, -dd / 2, 0, w, dd, 7, 4);
    return root;
  },
  /** Trash: the bin, open, empty (Inbox sibling). */
  trash() {
    const root = g({ transform: "translate(0 2)" });
    container(root, { w: 76, h: 88, rim: 24, taper: 8, rb: 10 });
    return root;
  },
  /** Folder: open folder, frontal — back panel with tab, front panel, gap between. */
  folder() {
    const root = g({ transform: "translate(0 2)" });
    const w = 92;
    const rb = 8;
    const back = `M${-w / 2} -30 Q${-w / 2} -38 ${-w / 2 + 8} -38 L-14 -38 Q-8 -38 -6 -34 L-2 -28 L${w / 2 - 8} -28 Q${w / 2} -28 ${w / 2} -20 L${w / 2} 30 L${-w / 2} 30 Z`;
    put(root, el("path", { d: back, transform: "translate(0 4)", line: FILL }));
    put(root, el("path", { d: back, line: FILL }));
    put(root, el("path", { d: `M${-w / 2 + 10} 0 L${w / 2 - 10} 0`, line: SOFT }));
    const front = `M${-w / 2 - 2} -6 L${w / 2 + 2} -6 L${w / 2 - 2} ${36 - rb} Q${w / 2 - 3} 36 ${w / 2 - 2 - rb} 36 L${-w / 2 + 2 + rb} 36 Q${-w / 2 + 3} 36 ${-w / 2 + 2} ${36 - rb} Z`;
    put(root, el("path", { d: front, transform: "translate(0 4)", line: FILL }));
    put(root, el("path", { d: front, line: FILL }));
    return root;
  },
  /** Devices: laptop and phone, frontal — the Devices icon, physical. */
  devices() {
    const root = g({ transform: "translate(-8 4)" });
    put(root, el("rect", { x: -52, y: -40, width: 76, height: 50, rx: 6, transform: "translate(0 4)", line: FILL }));
    put(root, el("rect", { x: -52, y: -40, width: 76, height: 50, rx: 6, line: FILL }));
    put(root, el("rect", { x: -47, y: -35, width: 66, height: 40, rx: 3, line: SOFT }));
    put(root, el("path", { d: "M-62 22 L-52 10 L24 10 L34 22 Q34 26 30 26 L-58 26 Q-62 26 -62 22 Z", line: FILL }));
    put(root, el("rect", { x: 40, y: -20, width: 26, height: 46, rx: 5, transform: "translate(0 4)", line: FILL }));
    put(root, el("rect", { x: 40, y: -20, width: 26, height: 46, rx: 5, line: FILL }));
    put(root, el("path", { d: "M49 -14 h8", line: SOFT }));
    return root;
  },
};

/* ---- JSX emit ---- */
const fmt = (v) => (typeof v === "number" ? String(Math.round(v * 100) / 100) : v);
function jsx(node, depth) {
  const pad = "  ".repeat(depth);
  const attrs = Object.entries(node.attrs)
    .filter(([k, v]) => v !== undefined && !(k === "line" && v === undefined))
    .map(([k, v]) => {
      if (k === "line") return `data-line="${v}"`;
      if (typeof v === "number") return `${k}={${fmt(v)}}`;
      return `${k}="${v}"`;
    })
    .join(" ");
  const open = `<${node.tag}${attrs ? " " + attrs : ""}`;
  if (node.children.length === 0) return `${pad}${open} />`;
  return `${pad}${open}>\n${node.children.map((c) => jsx(c, depth + 1)).join("\n")}\n${pad}</${node.tag}>`;
}

const names = Object.keys(GLYPHS);
const out = [];
out.push(`import { cn } from "@rune/ui/lib/utils";`);
out.push(``);
out.push(`/**`);
out.push(` * Empty-state glyphs. GENERATED by scripts/empty-glyphs.mjs — do not hand-edit;`);
out.push(` * change the script and re-run it. One object per state, each derived from the`);
out.push(` * section's sidebar icon, drawn with a 1.5px stroke and a 4px slab thickness.`);
out.push(` * Stroke colours live in globals.css under [data-slot="empty-glyph"].`);
out.push(` */`);
out.push(`export type EmptyGlyphName = ${names.map((n) => `"${n}"`).join(" | ")};`);
out.push(``);
out.push(`/** 140×120 box in CSS px; ink is 90–110px wide, matching Linear's Inbox and Drafts. */`);
out.push(`export function EmptyGlyph({ name, className }: { name: EmptyGlyphName; className?: string }) {`);
out.push(`  const Body = GLYPHS[name];`);
out.push(`  return (`);
out.push(`    <svg`);
out.push(`      viewBox="-70 -60 140 120"`);
out.push(`      data-slot="empty-glyph"`);
out.push(`      aria-hidden="true"`);
out.push(`      className={cn("h-[120px] w-[140px] overflow-visible", className)}`);
out.push(`    >`);
out.push(`      <Body />`);
out.push(`    </svg>`);
out.push(`  );`);
out.push(`}`);
out.push(``);
out.push(`const GLYPHS: Record<EmptyGlyphName, () => React.JSX.Element> = {`);
for (const n of names) {
  out.push(`  ${n}: () => (`);
  out.push(jsx(GLYPHS[n](), 2));
  out.push(`  ),`);
}
out.push(`};`);
process.stdout.write(out.join("\n") + "\n");
