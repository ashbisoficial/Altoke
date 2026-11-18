"""
Añade data-testid a los elementos interactivos de JSX que no lo tienen (F0-3).

Convención: area-elemento-accion, por ejemplo `issue-detail-button-guardar`.
  - area: nombre del archivo en kebab-case.
  - elemento: button, input, select, textarea.
  - accion: texto visible, aria-label o placeholder en kebab-case; si no hay
    texto literal, el índice del elemento dentro del archivo.

Es determinista: el mismo código produce los mismos selectores. Los elementos
que ya tienen data-testid no se modifican.

Uso:
  python3 scripts/add-testids.py --write <archivos.tsx>   aplica los cambios
  python3 scripts/add-testids.py --check <archivos.tsx>   falla si falta algún selector (usado en CI)
"""
import re
import sys
import unicodedata

TAGS = ("button", "input", "select", "textarea", "Button", "Input")
TAG_RE = re.compile(r"<(%s)(?=[\s>/])" % "|".join(TAGS))


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:40].strip("-")


def opening_tag_end(src: str, start: int) -> int:
    """Índice del '>' que cierra la etiqueta de apertura, respetando llaves y comillas."""
    depth = 0
    i = start
    quote = None
    while i < len(src):
        c = src[i]
        if quote:
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return i
        i += 1
    raise ValueError("etiqueta sin cerrar")


def literal_attr(tag: str, name: str):
    m = re.search(r'\b%s="([^"]*)"' % name, tag)
    return m.group(1) if m else None


def visible_text(src: str, end: int, tag_name: str) -> str:
    if tag_name not in ("button",):
        return ""
    close = src.find("</button>", end)
    if close == -1:
        return ""
    inner = src[end + 1 : close]
    if "{" in inner.replace("{/*", ""):
        # texto dinámico: solo tomamos el texto literal si lo hay
        pass
    text = re.sub(r"<[^>]+>", " ", inner)
    text = re.sub(r"\{[^{}]*\}", " ", text)
    return " ".join(text.split())


def process(path: str, write: bool) -> int:
    src = open(path, encoding="utf-8").read()
    area = re.sub(r"\.tsx$", "", path.split("/")[-1])
    area = re.sub(r"(?<!^)([A-Z])", r"-\1", area).lower().strip("-")

    out = []
    pos = 0
    skip_until = 0
    used = set()
    existing = set(re.findall(r'data-testid="([^"]+)"', src))
    index = 0
    added = 0
    for m in TAG_RE.finditer(src):
        if m.start() < skip_until:
            continue
        tag_name = m.group(1)
        end = opening_tag_end(src, m.start())
        tag = src[m.start() : end + 1]
        # Etiquetas ya marcadas: no se tocan, pero el texto que las rodea sí se conserva.
        if "data-testid" in tag:
            skip_until = end + 1
            continue
        index += 1
        element = tag_name.lower()
        action = (
            literal_attr(tag, "aria-label")
            or literal_attr(tag, "placeholder")
            or visible_text(src, end, tag_name)
            or ""
        )
        action = slug(action) or str(index)
        base = f"{area}-{element}-{action}"
        name, n = base, 2
        while name in used or name in existing:
            name = f"{base}-{n}"
            n += 1
        used.add(name)
        insert_at = m.end()
        out.append(src[pos:insert_at])
        out.append(f' data-testid="{name}"')
        pos = insert_at
        added += 1
    out.append(src[pos:])
    new = "".join(out)
    if write and added:
        open(path, "w", encoding="utf-8").write(new)
    print(f"{path}: {added} selectores {'añadidos' if write else 'pendientes'}")
    return added


if __name__ == "__main__":
    # --write: aplica los cambios. --check: falla (código 1) si falta algún selector.
    write = "--write" in sys.argv
    check = "--check" in sys.argv
    files = [a for a in sys.argv[1:] if a not in ("--write", "--check")]
    total = sum(process(f, write and not check) for f in files)
    print("TOTAL", total)
    if check and total:
        print("Faltan data-testid en elementos interactivos. Ejecuta: python3 scripts/add-testids.py --write <archivos>")
        sys.exit(1)
