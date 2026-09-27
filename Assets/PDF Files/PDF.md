# PDF Files

Printable documents for job applications.

| File | What it is |
|---|---|
| `Imaad_Yameen_Professional_Portfolio.docx` | Full professional portfolio — summary, skills, work and internship history, engineering projects, the software portfolio, education and all certifications. |
| `Imaad_Yameen_Professional_Portfolio.pdf` | The same document exported to PDF. |
| `Imaad_Yameen_Certifications.pdf` | Certification list. |
| `Imaad_Yameen_Experience.pdf` | Experience summary. |
| `build_portfolio_docx.py` | Generates the portfolio `.docx`. |

## Regenerating the portfolio document

    python3 "Assets/PDF Files/build_portfolio_docx.py"

The document is **generated, not hand-written**. Its content is read out of the
site itself — work history, internships, projects, education and skills from
`Assets/resume/cv.html`, and the certification list from `index.html`. Update
the website and re-run the script, and the document matches; there is no second
copy of the content to keep in sync.

The script uses only the Python standard library. A `.docx` is a ZIP of XML
parts, so it writes those parts directly rather than adding a dependency —
consistent with the rest of this repository.

To refresh the PDF afterwards, open the `.docx` and export it as PDF (in Word:
*File → Save As → PDF*).

## Why the formatting looks plain

Deliberately. The document is built to survive an applicant tracking system
(ATS), which is the software that reads a CV before a person does. Following
current guidance, it uses:

- a single-column layout — no tables, text boxes, sidebars or columns, which
  are the most common cause of a document parsing into nonsense;
- contact details in the body rather than in a page header, because many
  parsers never read headers or footers;
- standard section headings (*Professional Summary*, *Work Experience*,
  *Education*, *Technical Skills*, *Certifications*) that parsers recognise;
- Calibri 11pt body text;
- real Word bullet lists, so the bullet character lives in the numbering
  definition instead of sitting inside the text;
- full month-and-year dates rather than numeric shorthand;
- no images, icons or charts — an ATS cannot read any of them.

Sources for that guidance:

- [ATS-Friendly Resume Format Guide (2026)](https://atsverification.com/blog/ats-friendly-resume-format-guide-2026/)
- [ATS Resume Format 2026: What Works (and What Doesn't)](https://scale.jobs/blog/ats-resume-format-2026-design-guide)
- [The best resume format in 2026 — Microsoft Word Blog](https://word.cloud.microsoft/create/en/blog/best-resume-formats/)
- [How to create a comprehensive engineering portfolio — IET](https://engineering-jobs.theiet.org/article/how-to-create-a-comprehensive-engineering-portfolio)
- [How to Create an Engineering Portfolio — Techneeds](https://www.techneeds.com/2025/01/13/how-to-create-an-engineering-portfolio-a-step-by-step-guide/)
