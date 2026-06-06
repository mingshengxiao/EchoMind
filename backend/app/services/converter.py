import subprocess
import tempfile
from pathlib import Path


def docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert DOCX bytes to PDF bytes using LibreOffice headless."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.docx"
        output_path = Path(tmpdir) / "input.pdf"

        input_path.write_bytes(docx_bytes)

        result = subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, str(input_path)],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.decode()}")

        return output_path.read_bytes()


def is_libreoffice_available() -> bool:
    """Check if LibreOffice is installed."""
    try:
        subprocess.run(["soffice", "--headless", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
