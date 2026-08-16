/**
 * Design tokens for your agent's UI.
 *
 * Every key becomes a CSS custom property on the kit's themed root, so
 * `accent` sets `--accent`. Uncomment a token to override it; delete a key to
 * inherit the kit default; delete this file to inherit all of them.
 *
 * Colors are space-separated HSL channels **without** the `hsl()` wrapper —
 * that is the format the kit's stylesheet expects:
 *
 *     accent: "221 83% 53%"        ✓
 *     accent: "hsl(221 83% 53%)"   ✗
 *     accent: "#2563eb"            ✗
 *
 * Lengths are plain CSS values ("0.75rem", "44rem").
 */
const theme: Record<string, string> = {
  // ── Color ────────────────────────────────────────────────────
  // background: "0 0% 0%",
  // foreground: "210 40% 96%",
  // accent: "221 83% 53%",
  // muted: "0 0% 7%",
  // border: "240 4% 14%",

  // ── Shape & type ─────────────────────────────────────────────
  // radius: "0.75rem",
  // "font-inter": "system-ui, sans-serif",

  // ── Layout ───────────────────────────────────────────────────
  // "content-width-response": "44rem",
};

export default theme;
