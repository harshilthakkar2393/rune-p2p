import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");

/** The component is generated; a hand edit would drift from the script. */
describe("empty-glyph.tsx", () => {
  test("matches the output of scripts/empty-glyphs.mjs, formatted", () => {
    const run = Bun.spawnSync(["node", join(root, "scripts", "empty-glyphs.mjs")]);
    expect(run.exitCode).toBe(0);
    const tmp = join(tmpdir(), `empty-glyph-${process.pid}.tsx`);
    writeFileSync(tmp, run.stdout);
    const fmt = Bun.spawnSync(["bunx", "oxfmt", tmp], { cwd: root });
    expect(fmt.exitCode).toBe(0);
    const generated = readFileSync(tmp, "utf8");
    rmSync(tmp);
    const committed = readFileSync(join(root, "src", "components", "empty-glyph.tsx"), "utf8");
    expect(committed).toBe(generated);
  });

  test("every glyph has a filled slab contour and no dashed or reflected parts", () => {
    const src = readFileSync(join(root, "src", "components", "empty-glyph.tsx"), "utf8");
    for (const name of ["home", "pages", "trash", "folder", "devices"]) {
      expect(src).toContain(`  ${name}: () => (`);
    }
    expect(src).toContain('data-line="fill"');
    expect(src).not.toContain('data-line="dash"');
    expect(src).not.toContain("data-reflection");
  });
});
