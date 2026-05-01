from dataclasses import dataclass
from html.parser import HTMLParser
from html import escape
from pathlib import Path
from typing import Iterable
from zipfile import BadZipFile, ZIP_DEFLATED, ZipFile
import xml.etree.ElementTree as ET
import re

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


def _looks_like_html_fragment(text: str) -> bool:
    return bool(
        re.search(
            r"</?(?:p|div|h[1-6]|table|tbody|thead|tfoot|tr|td|th|ul|ol|li|br|strong|b|em|i|u|span)\b",
            text,
            flags=re.IGNORECASE,
        )
    )


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
    if _looks_like_html_fragment(text):
        return _normalize_html_fragment(text)
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
    normalized = (
        html_content
        .replace("<br>", "<br />")
        .replace("<br/>", "<br />")
        .replace("&nbsp;", "&#160;")
    )
    normalized = re.sub(r"<colgroup\b[^>]*>.*?</colgroup>", "", normalized, flags=re.IGNORECASE | re.DOTALL)
    normalized = re.sub(r"<col\b[^>]*>", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(
        r"<(img|input|hr|meta|link)\b([^>]*)>",
        lambda match: match.group(0) if match.group(2).rstrip().endswith("/") else f"<{match.group(1)}{match.group(2)} />",
        normalized,
        flags=re.IGNORECASE,
    )
    return normalized


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


def _style_map_from_attrs(attrs: dict[str, str]) -> dict[str, str]:
    raw_style = attrs.get("style", "")
    style_map: dict[str, str] = {}
    for declaration in raw_style.split(";"):
        if ":" not in declaration:
            continue
        key, value = declaration.split(":", 1)
        style_map[key.strip().lower()] = value.strip().lower()
    return style_map


def _alignment_from_attrs(attrs: dict[str, str]) -> str:
    align_attr = (attrs.get("align", "") or "").strip().lower()
    if align_attr in {"left", "center", "right", "justify"}:
        return "both" if align_attr == "justify" else align_attr

    style_align = _style_map_from_attrs(attrs).get("text-align", "")
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


class _ForgivingHtmlToDocxParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[WordParagraph | WordTable] = []
        self._tag_stack: list[str] = []
        self._current_runs: list[WordRun] | None = None
        self._current_style = "Normal"
        self._current_alignment = "left"
        self._list_stack: list[bool] = []
        self._ordered_index_stack: list[int] = []
        self._table_rows: list[WordTableRow] | None = None
        self._table_row_cells: list[WordTableCell] | None = None
        self._cell_paragraphs: list[WordParagraph] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attr_map = {key.lower(): value or "" for key, value in attrs}

        if tag in {"colgroup", "col", "tbody", "thead", "tfoot"}:
            return
        if tag == "br":
            self._ensure_paragraph()
            self._append_text("\n")
            return
        if tag == "table":
            self._end_paragraph()
            if self._table_rows is None:
                self._table_rows = []
            return
        if tag == "tr" and self._table_rows is not None:
            self._end_paragraph()
            self._table_row_cells = []
            return
        if tag in {"td", "th"} and self._table_row_cells is not None:
            self._end_paragraph()
            self._cell_paragraphs = []
            return
        if tag in {"ul", "ol"}:
            self._list_stack.append(tag == "ol")
            self._ordered_index_stack.append(1)
            return
        if tag in {"p", "div", "h1", "h2", "h3", "li"}:
            self._end_paragraph()
            style = f"Heading{tag[1]}" if tag in {"h1", "h2", "h3"} else "Normal"
            self._begin_paragraph(style=style, alignment=_alignment_from_attrs(attr_map))
            if tag == "li":
                ordered = self._list_stack[-1] if self._list_stack else False
                if ordered:
                    index = self._ordered_index_stack[-1] if self._ordered_index_stack else 1
                    self._append_text(f"{index}. ")
                    if self._ordered_index_stack:
                        self._ordered_index_stack[-1] = index + 1
                else:
                    self._append_text("* ")
            return

        self._tag_stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"p", "div", "h1", "h2", "h3", "li"}:
            self._end_paragraph()
            return
        if tag in {"td", "th"} and self._table_row_cells is not None:
            self._end_paragraph()
            paragraphs = self._cell_paragraphs or [WordParagraph(runs=[WordRun(text="")])]
            self._table_row_cells.append(WordTableCell(paragraphs=paragraphs))
            self._cell_paragraphs = None
            return
        if tag == "tr" and self._table_rows is not None:
            self._end_paragraph()
            if self._table_row_cells:
                self._table_rows.append(WordTableRow(cells=self._table_row_cells))
            self._table_row_cells = None
            return
        if tag == "table" and self._table_rows is not None:
            self._end_paragraph()
            self.blocks.append(WordTable(rows=self._table_rows))
            self._table_rows = None
            self._table_row_cells = None
            self._cell_paragraphs = None
            return
        if tag in {"ul", "ol"}:
            if self._list_stack:
                self._list_stack.pop()
            if self._ordered_index_stack:
                self._ordered_index_stack.pop()
            return
        if tag in self._tag_stack:
            self._tag_stack.reverse()
            self._tag_stack.remove(tag)
            self._tag_stack.reverse()

    def handle_data(self, data: str) -> None:
        if not data:
            return
        self._ensure_paragraph()
        self._append_text(data)

    def close(self) -> None:
        super().close()
        self._end_paragraph()
        if self._table_row_cells is not None:
            if self._cell_paragraphs is not None:
                self._table_row_cells.append(WordTableCell(paragraphs=self._cell_paragraphs or [WordParagraph(runs=[WordRun(text="")])]))
            if self._table_rows is not None and self._table_row_cells:
                self._table_rows.append(WordTableRow(cells=self._table_row_cells))
        if self._table_rows is not None:
            self.blocks.append(WordTable(rows=self._table_rows))

    def _begin_paragraph(self, *, style: str = "Normal", alignment: str = "left") -> None:
        self._current_runs = []
        self._current_style = style
        self._current_alignment = alignment

    def _ensure_paragraph(self) -> None:
        if self._current_runs is None:
            self._begin_paragraph()

    def _end_paragraph(self) -> None:
        if self._current_runs is None:
            return

        runs = self._current_runs or [WordRun(text="")]
        paragraph = WordParagraph(runs=runs, style=self._current_style, alignment=self._current_alignment)
        if self._cell_paragraphs is not None:
            self._cell_paragraphs.append(paragraph)
        else:
            self.blocks.append(paragraph)
        self._current_runs = None
        self._current_style = "Normal"
        self._current_alignment = "left"

    def _append_text(self, text: str) -> None:
        if self._current_runs is None:
            self._begin_paragraph()
        active = set(self._tag_stack)
        node_style: dict[str, str] = {}
        self._current_runs.append(
            WordRun(
                text=text,
                bold=bool(active.intersection({"strong", "b"})),
                italic=bool(active.intersection({"em", "i"})),
                underline=bool(active.intersection({"u", "ins"})),
                strike=bool(active.intersection({"s", "strike", "del"})),
            )
        )


def _parse_html_forgiving(html_content: str) -> list[WordParagraph | WordTable]:
    parser = _ForgivingHtmlToDocxParser()
    parser.feed(_normalize_html_fragment(html_content))
    parser.close()
    return parser.blocks


def html_to_docx_blocks(html_content: str) -> list[WordParagraph | WordTable]:
    wrapped = f"<root>{_normalize_html_fragment(html_content)}</root>"
    try:
        root = ET.fromstring(wrapped)
    except ET.ParseError:
        blocks = _parse_html_forgiving(html_content)
        if blocks:
            return blocks
        escaped = re.sub(r"<[^>]+>", "", html_content).replace("\r\n", "\n")
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


def docx_contains_raw_html_text(path: Path) -> bool:
    try:
        with ZipFile(path) as archive:
            document_xml = archive.read("word/document.xml")
    except (BadZipFile, KeyError, FileNotFoundError):
        return False

    try:
        root = ET.fromstring(document_xml)
    except ET.ParseError:
        return False

    return any(_looks_like_html_fragment(_paragraph_text(paragraph)) for paragraph in root.findall(".//w:p", NS))


def repair_docx_if_raw_html(path: Path) -> bool:
    if not docx_contains_raw_html_text(path):
        return False

    html_content = load_docx_preview(path)
    save_docx_from_html(path, html_content)
    return True
