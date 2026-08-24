// Blocking script: applies the saved theme/custom colors before first paint,
// so there's no flash of the default theme on reload. Self-contained (no
// imports) on purpose — it has to run as a plain inline <script>.
const SCRIPT = `(function () {
  try {
    var theme = localStorage.getItem("altoke-theme");
    if (theme && theme !== "light") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    var raw = localStorage.getItem("altoke-custom-colors");
    if (raw) {
      var colors = JSON.parse(raw);
      var toTriple = function (hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        var v = m[1];
        return parseInt(v.slice(0, 2), 16) + " " + parseInt(v.slice(2, 4), 16) + " " + parseInt(v.slice(4, 6), 16);
      };
      var readableInk = function (triple) {
        var p = triple.split(" ").map(Number);
        var lin = function (c) {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        var lum = 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
        return lum > 0.5 ? "10 10 15" : "255 255 255";
      };
      ["accent", "accent2", "accent3"].forEach(function (key) {
        if (!colors[key]) return;
        var triple = toTriple(colors[key]);
        if (!triple) return;
        document.documentElement.style.setProperty("--" + key, triple);
        if (key === "accent") document.documentElement.style.setProperty("--accent-ink", readableInk(triple));
      });
    }
  } catch (e) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
