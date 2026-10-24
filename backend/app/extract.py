"""Turn an uploaded PDF / .eml / .txt into plain text for the AI."""
import io
from email import policy
from email.parser import BytesParser

from pypdf import PdfReader


def from_pdf(data: bytes) -> tuple[str, list[str]]:
    reader = PdfReader(io.BytesIO(data))
    pages = [(p.extract_text() or "").strip() for p in reader.pages]
    text = "\n\n".join(p for p in pages if p)
    warnings = []
    if not text:
        warnings.append("No selectable text found. This looks like a scanned PDF; OCR is not enabled.")
    return text, warnings


def from_eml(data: bytes) -> tuple[str, list[str]]:
    msg = BytesParser(policy=policy.default).parsebytes(data)
    body = msg.get_body(preferencelist=("plain", "html"))
    content = body.get_content() if body else ""
    attachments = [p.get_filename() for p in msg.iter_attachments() if p.get_filename()]
    header = (
        f"From: {msg.get('From', '')}\nTo: {msg.get('To', '')}\n"
        f"Date: {msg.get('Date', '')}\nSubject: {msg.get('Subject', '')}\n"
    )
    warnings = [f"Attachments not read: {', '.join(attachments)}"] if attachments else []
    return f"{header}\n{content}".strip(), warnings


def extract_text(filename: str, data: bytes) -> tuple[str, str, list[str]]:
    """Returns (text, source_type, warnings)."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text, warnings = from_pdf(data)
        return text, "pdf", warnings
    if name.endswith(".eml"):
        text, warnings = from_eml(data)
        return text, "email", warnings
    return data.decode("utf-8", errors="replace").strip(), "text", []
