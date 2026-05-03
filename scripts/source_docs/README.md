# Source Documents for RAG Knowledge Base

Place your agronomic source documents here as plain `.txt` files, organized by language folder.

## Directory Structure

```
scripts/source_docs/
  en/        ← English documents (.txt)
  si/        ← Sinhala documents (.txt)
  ta/        ← Tamil documents (.txt)
```

## Suggested Sources

- TRI (Tea Research Institute of Sri Lanka) handbooks
- SLSI standard specifications for tea
- TRI extension leaflets and advisories
- Fertigation and fertilizer recommendation guides
- Pest and disease management manuals

## Converting PDFs to Text

If your documents are PDFs, convert them first:

```bash
# Using pdftotext (poppler-utils)
pdftotext input.pdf output.txt

# Using Python
pip install pymupdf
python -c "import fitz; doc=fitz.open('input.pdf'); [open('output.txt','w').write(p.get_text()) for p in doc]"
```

## Running the Data Prep Script

After placing documents here, run:

```bash
# Get a FREE Gemini API key from https://aistudio.google.com/app/apikey
export GEMINI_API_KEY=your-api-key-here

# Run the script for English only
node scripts/prepareRagChunks.mjs --lang en

# Run for all languages
node scripts/prepareRagChunks.mjs
```

Output files are written to `src/assets/knowledge/rag_chunks_{lang}.json`.
