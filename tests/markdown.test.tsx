import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/markdown/Markdown";

/** F1-1: el HTML del usuario se muestra como texto, nunca como código activo. */
describe("Markdown seguro", () => {
  it("renderiza negrita y listas", () => {
    const html = renderToStaticMarkup(<Markdown>{"**fuerte**\n\n- uno\n- dos"}</Markdown>);
    expect(html).toContain("<strong>fuerte</strong>");
    expect(html).toContain("<li>uno</li>");
  });

  it("no ejecuta etiquetas script ni HTML crudo", () => {
    const html = renderToStaticMarkup(<Markdown>{'<script>alert(1)</script> <img src=x onerror="alert(2)">'}</Markdown>);
    // El HTML llega como texto escapado: no existe ningún elemento real.
    expect(html).not.toMatch(/<script[\s>]/);
    expect(html).not.toMatch(/<img[\s>]/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("bloquea enlaces javascript:", () => {
    const html = renderToStaticMarkup(<Markdown>{"[clic](javascript:alert(3))"}</Markdown>);
    expect(html).not.toContain("javascript:");
  });

  it("los enlaces normales se abren en otra pestaña sin acceso al origen", () => {
    const html = renderToStaticMarkup(<Markdown>{"[docs](https://example.com)"}</Markdown>);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
