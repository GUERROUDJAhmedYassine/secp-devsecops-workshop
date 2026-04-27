from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Iterable
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile
import xml.etree.ElementTree as ET

WORDPROCESSING_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORDPROCESSING_NS}

TEXT_EXTENSIONS = {".txt", ".md", ".csv"}
HTML_EXTENSIONS = {".html", ".htm"}
DOCX_EXTENSIONS = {".docx"}

TEXT_MIME_TYPES = {"text/plain", "text/markdown", "text/csv", "application/csv"}
HTML_MIME_TYPES = {"text/html"}
DOCX_MIME_TYPES = {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


@dataclass
class WordRun:
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strike: bool = False


@dataclass
class WordParagraph:
    runs: list[WordRun]
    style: str = "Normal"
    alignment: str = "left"


@dataclass
class WordTableCell:
    paragraphs: list[WordParagraph]


@dataclass
class WordTableRow:
    cells: list[WordTableCell]


@dataclass
class WordTable:
    rows: list[WordTableRow]


def normalize_mime_type(mime_type: str | None) -> str:
    return (mime_type or "").split(";", 1)[0].strip().lower()


def is_docx_file(filename: str, mime_type: str | None) -> bool:
    extension = Path(filename).suffix.lower()
    normalized_mime = normalize_mime_type(mime_type)
    return extension in DOCX_EXTENSIONS or normalized_mime in DOCX_MIME_TYPES


def preview_kind_for_file(filename: str, mime_type: str | None) -> str | None:
    extension = Path(filename).suffix.lower()
    normalized_mime = normalize_mime_type(mime_type)

    if is_docx_file(filename, mime_type):
        return "html"
    if extension in HTML_EXTENSIONS or normalized_mime in HTML_MIME_TYPES:
        return "text"
    if extension in TEXT_EXTENSIONS or normalized_mime in TEXT_MIME_TYPES:
        return "text"
    return None


def load_text_preview(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _plain_text_to_html(text: str) -> str:
    normalized = text.replace("\r\n", "\n")
    if not normalized.strip():
        return "<p>No preview available.</p>"
    return "".join(f"<p>{escape(line) or '&nbsp;'}</p>" for line in normalized.split("\n"))


def _paragraph_text(element: ET.Element) -> str:
    parts: list[str] = []
    for node in element.iter():
        tag = node.tag
        if tag == f"{{{WORDPROCESSING_NS}}}t":
            parts.append(node.text or "")
        elif tag == f"{{{WORDPROCESSING_NS}}}tab":
            parts.append("\t")
        elif tag in {f"{{{WORDPROCESSING_NS}}}br", f"{{{WORDPROCESSING_NS}}}cr"}:
            parts.append("\n")
    return "".join(parts)


def _paragraph_html(element: ET.Element) -> str:
    text = _paragraph_text(element)
    if not text.strip():
        return "<p>&nbsp;</p>"
    safe_text = "<br />".join(escape(part) for part in text.splitlines())
    return f"<p>{safe_text}</p>"


def _table_html(element: ET.Element) -> str:
    rows_html: list[str] = []
    for row in element.findall("w:tr", NS):
        cells_html: list[str] = []
        for cell in row.findall("w:tc", NS):
            paragraphs = cell.findall("w:p", NS)
            cell_body = "".join(_paragraph_html(paragraph) for paragraph in paragraphs) or "<p>&nbsp;</p>"
            cells_html.append(f"<td>{cell_body}</td>")
        if cells_html:
            rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
    return f"<table>{''.join(rows_html)}</table>" if rows_html else ""


def load_docx_preview(path: Path) -> str:
    try:
        with ZipFile(path) as archive:
            document_xml = archive.read("word/document.xml")
    except (BadZipFile, KeyError):
        fallback_text = path.read_text(encoding="utf-8", errors="ignore")
        if not fallback_text.strip():
            return "<p></p>"
        return _plain_text_to_html(fallback_text)

    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        return "<p>No preview available.</p>"

    blocks: list[str] = []
    for child in body:
        if child.tag == f"{{{WORDPROCESSING_NS}}}p":
            blocks.append(_paragraph_html(child))
        elif child.tag == f"{{{WORDPROCESSING_NS}}}tbl":
            table_html = _table_html(child)
            if table_html:
                blocks.append(table_html)

    return "".join(blocks) or "<p>No preview available.</p>"


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _normalize_html_fragment(html_content: str) -> str:
    return (
        html_content
        .replace("<br>", "<br />")
        .replace("<br/>", "<br />")
        .replace("&nbsp;", "&#160;")
    )


def _style_map(node: ET.Element) -> dict[str, str]:
    raw_style = node.attrib.get("style", "")
    style_map: dict[str, str] = {}
    for declaration in raw_style.split(";"):
        if ":" not in declaration:
            continue
        key, value = declaration.split(":", 1)
        style_map[key.strip().lower()] = value.strip().lower()
    return style_map


def _extract_alignment(node: ET.Element) -> str:
    align_attr = (node.attrib.get("align", "") or "").strip().lower()
    if align_attr in {"left", "center", "right", "justify"}:
        return "both" if align_attr == "justify" else align_attr

    style_align = _style_map(node).get("text-align", "")
    if style_align in {"left", "center", "right", "justify"}:
        return "both" if style_align == "justify" else style_align
    return "left"


def _append_run(
    runs: list[WordRun],
    text: str,
    *,
    bold: bool = False,
    italic: bool = False,
    underline: bool = False,
    strike: bool = False,
) -> None:
    if text == "":
        return
    runs.append(WordRun(text=text, bold=bold, italic=italic, underline=underline, strike=strike))


def _collect_inline_runs(
    node: ET.Element,
    *,
    bold: bool = False,
    italic: bool = False,
    underline: bool = False,
    strike: bool = False,
) -> list[WordRun]:
    runs: list[WordRun] = []
    node_style = _style_map(node)
    bold = bold or node_style.get("font-weight") in {"bold", "700", "800", "900"}
    italic = italic or node_style.get("font-style") == "italic"
    text_decoration = node_style.get("text-decoration", "")
    underline = underline or "underline" in text_decoration
    strike = strike or "line-through" in text_decoration

    if node.text:
        _append_run(runs, node.text, bold=bold, italic=italic, underline=underline, strike=strike)

    for child in list(node):
        child_tag = _local_tag(child.tag).lower()
        child_bold = bold or child_tag in {"strong", "b"}
        child_italic = italic or child_tag in {"em", "i"}
        child_underline = underline or child_tag in {"u", "ins"}
        child_strike = strike or child_tag in {"s", "strike", "del"}

        if child_tag == "br":
            _append_run(runs, "\n", bold=bold, italic=italic, underline=underline, strike=strike)
        else:
            runs.extend(
                _collect_inline_runs(
                    child,
                    bold=child_bold,
                    italic=child_italic,
                    underline=child_underline,
                    strike=child_strike,
                )
            )

        if child.tail:
            _append_run(runs, child.tail, bold=bold, italic=italic, underline=underline, strike=strike)

    return runs


def _inline_paragraph(node: ET.Element, *, style: str = "Normal") -> WordParagraph:
    return WordParagraph(
        runs=_collect_inline_runs(node) or [WordRun(text="")],
        style=style,
        alignment=_extract_alignment(node),
    )


def _list_to_paragraphs(list_node: ET.Element, *, ordered: bool) -> list[WordParagraph]:
    paragraphs: list[WordParagraph] = []
    item_index = 1
    for item in list_node.findall("./li"):
        prefix = f"{item_index}. " if ordered else "* "
        if ordered:
            item_index += 1
        runs = [WordRun(text=prefix)]
        runs.extend(_collect_inline_runs(item) or [WordRun(text="")])
        paragraphs.append(WordParagraph(runs=runs))
    return paragraphs


def _word_table_to_flat_paragraphs(table: WordTable) -> list[WordParagraph]:
    paragraphs: list[WordParagraph] = []
    for row in table.rows:
        cell_texts: list[str] = []
        for cell in row.cells:
            text = " ".join(
                "".join(run.text for run in paragraph.runs).strip()
                for paragraph in cell.paragraphs
            ).strip()
            cell_texts.append(text)
        if cell_texts:
            paragraphs.append(WordParagraph(runs=[WordRun(text=" | ".join(cell_texts))]))
    return paragraphs


def _root_text_to_paragraphs(root: ET.Element) -> list[WordParagraph]:
    text = "".join(root.itertext()).strip()
    if not text:
        return [WordParagraph(runs=[WordRun(text="")])]
    return [WordParagraph(runs=[WordRun(text=line)]) for line in text.splitlines() or [""]]


def _html_node_to_blocks(node: ET.Element) -> list[WordParagraph | WordTable]:
    tag = _local_tag(node.tag).lower()

    if tag in {"p", "div"}:
        return [_inline_paragraph(node)]
    if tag in {"h1", "h2", "h3"}:
        return [_inline_paragraph(node, style=f"Heading{tag[1]}")]
    if tag == "ul":
        return _list_to_paragraphs(node, ordered=False)
    if tag == "ol":
        return _list_to_paragraphs(node, ordered=True)
    if tag == "pre":
        text = "".join(node.itertext()).replace("\r\n", "\n")
        return [WordParagraph(runs=[WordRun(text=line)]) for line in text.split("\n")]
    if tag == "table":
        return [_html_table_to_word_table(node)]

    inline_runs = _collect_inline_runs(node)
    if inline_runs:
        return [WordParagraph(runs=inline_runs)]
    return []


def _html_table_to_word_table(table_node: ET.Element) -> WordTable:
    row_nodes: list[ET.Element] = []
    for child in list(table_node):
        child_tag = _local_tag(child.tag).lower()
        if child_tag == "tr":
            row_nodes.append(child)
        elif child_tag in {"thead", "tbody", "tfoot"}:
            row_nodes.extend(
                grandchild
                for grandchild in list(child)
                if _local_tag(grandchild.tag).lower() == "tr"
            )

    if not row_nodes:
        row_nodes = [node for node in table_node.findall(".//tr")]

    rows: list[WordTableRow] = []
    for row_node in row_nodes:
        cells: list[WordTableCell] = []
        for cell_node in list(row_node):
            if _local_tag(cell_node.tag).lower() not in {"td", "th"}:
                continue

            paragraphs: list[WordParagraph] = []
            for child in list(cell_node):
                for block in _html_node_to_blocks(child):
                    if isinstance(block, WordParagraph):
                        paragraphs.append(block)
                    else:
                        paragraphs.extend(_word_table_to_flat_paragraphs(block))

            if not paragraphs:
                paragraphs = [_inline_paragraph(cell_node)]

            cells.append(WordTableCell(paragraphs=paragraphs))

        if cells:
            rows.append(WordTableRow(cells=cells))

    return WordTable(rows=rows)


def html_to_docx_blocks(html_content: str) -> list[WordParagraph | WordTable]:
    wrapped = f"<root>{_normalize_html_fragment(html_content)}</root>"
    try:
        root = ET.fromstring(wrapped)
    except ET.ParseError:
        escaped = html_content.replace("\r\n", "\n")
        return [WordParagraph(runs=[WordRun(text=line)]) for line in escaped.splitlines() or [""]]

    blocks: list[WordParagraph | WordTable] = []
    for child in list(root):
        blocks.extend(_html_node_to_blocks(child))

    if not blocks:
        blocks = _root_text_to_paragraphs(root)
    return blocks


def _runs_to_word_xml(runs: Iterable[WordRun]) -> str:
    xml_parts: list[str] = []
    for run in runs:
        segments = run.text.split("\n")
        for index, segment in enumerate(segments):
            run_properties: list[str] = []
            if run.bold:
                run_properties.append("<w:b/>")
            if run.italic:
                run_properties.append("<w:i/>")
            if run.underline:
                run_properties.append("<w:u w:val=\"single\"/>")
            if run.strike:
                run_properties.append("<w:strike/>")
            run_property_xml = f"<w:rPr>{''.join(run_properties)}</w:rPr>" if run_properties else ""
            xml_parts.append(
                f"<w:r>{run_property_xml}<w:t xml:space=\"preserve\">{escape(segment)}</w:t></w:r>"
            )
            if index < len(segments) - 1:
                xml_parts.append(f"<w:r>{run_property_xml}<w:br/></w:r>")
    if not xml_parts:
        xml_parts.append("<w:r><w:t xml:space=\"preserve\"></w:t></w:r>")
    return "".join(xml_parts)


def _paragraph_to_word_xml(paragraph: WordParagraph) -> str:
    ppr_parts: list[str] = []
    if paragraph.style != "Normal":
        ppr_parts.append(f"<w:pStyle w:val=\"{paragraph.style}\"/>")
    if paragraph.alignment != "left":
        ppr_parts.append(f"<w:jc w:val=\"{paragraph.alignment}\"/>")
    ppr_xml = f"<w:pPr>{''.join(ppr_parts)}</w:pPr>" if ppr_parts else ""
    return f"<w:p>{ppr_xml}{_runs_to_word_xml(paragraph.runs)}</w:p>"


def _table_cell_to_word_xml(cell: WordTableCell, col_width: int) -> str:
    paragraphs = cell.paragraphs or [WordParagraph(runs=[WordRun(text="")])]
    cell_body = "".join(_paragraph_to_word_xml(paragraph) for paragraph in paragraphs)
    return (
        "<w:tc>"
        f"<w:tcPr><w:tcW w:w=\"{col_width}\" w:type=\"dxa\"/></w:tcPr>"
        f"{cell_body}"
        "</w:tc>"
    )


def _table_to_word_xml(table: WordTable) -> str:
    rows = table.rows or [WordTableRow(cells=[WordTableCell(paragraphs=[WordParagraph(runs=[WordRun(text="")])])])]
    column_count = max(1, max(len(row.cells) for row in rows))
    total_width = 9000
    col_width = max(1200, total_width // column_count)
    empty_cell = WordTableCell(paragraphs=[WordParagraph(runs=[WordRun(text="")])])

    grid_xml = "".join(f"<w:gridCol w:w=\"{col_width}\"/>" for _ in range(column_count))
    rows_xml: list[str] = []
    for row in rows:
        cells = list(row.cells)
        while len(cells) < column_count:
            cells.append(empty_cell)
        rows_xml.append(
            "<w:tr>"
            + "".join(_table_cell_to_word_xml(cell, col_width) for cell in cells[:column_count])
            + "</w:tr>"
        )

    return (
        "<w:tbl>"
        "<w:tblPr>"
        "<w:tblW w:w=\"0\" w:type=\"auto\"/>"
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:left w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:right w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"8\" w:space=\"0\" w:color=\"auto\"/>"
        "</w:tblBorders>"
        "</w:tblPr>"
        f"<w:tblGrid>{grid_xml}</w:tblGrid>"
        f"{''.join(rows_xml)}"
        "</w:tbl>"
    )


def build_docx_document_xml(blocks: list[WordParagraph | WordTable]) -> str:
    body_xml_parts: list[str] = []
    for block in blocks:
        if isinstance(block, WordParagraph):
            body_xml_parts.append(_paragraph_to_word_xml(block))
        else:
            body_xml_parts.append(_table_to_word_xml(block))

    body_xml = "".join(body_xml_parts)
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        f"<w:body>{body_xml}"
        "<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/></w:sectPr>"
        "</w:body></w:document>"
    )


def _styles_xml() -> str:
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/></w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\"><w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/><w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr></w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\"><w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/><w:rPr><w:b/><w:sz w:val=\"28\"/></w:rPr></w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading3\"><w:name w:val=\"heading 3\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/><w:rPr><w:b/><w:sz w:val=\"24\"/></w:rPr></w:style>"
        "</w:styles>"
    )


def save_docx_from_html(path: Path, html_content: str) -> None:
    blocks = html_to_docx_blocks(html_content)
    document_xml = build_docx_document_xml(blocks)

    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
            "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
            "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
            "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
            "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
            "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
            "</Relationships>",
        )
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/styles.xml", _styles_xml())
