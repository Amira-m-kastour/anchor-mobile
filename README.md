# ANCHOR Mobile 1.2.0 — ANCHOR Studio by A. Mamdouh Kastour

*A. Mamdouh Kastour's Scholarly Anchor*, as a phone app: one self-contained web app that runs offline,
installed either as a **PWA** (any phone with a modern browser) or as an **Android APK**.
It opens and saves the same `.anchor` project files as ANCHOR Studio 1.5.x on a computer.

In tribute to Mamdouh Kastour (1950–2020).

New in 1.2.0: the Proposal / thesis tab (More > Proposal / thesis), the same as in ANCHOR Studio 1.7.0: outline, chapters linked to
approved phases, your text with versions, timeline chart, figures and attachments up to 20 MB, checks, and exports to Word (on your
template), HTML to print as PDF, and LaTeX. Corrections to the decision log. Proposals move between phone and computer.

New in 1.1.0: approved phases are locked ("Edit this approved phase" asks, reopens and logs); every version of every draft is kept
and can be restored; a new import or an exclusion marks approved phases C, H and O "needs review"; figures remember their data and
stale ones are marked in phase C; replacing the article flags approved phases. Same behaviour and project fields as ANCHOR Studio 1.6.0.

New in 1.0.1: after the retraction check (Bibliometrics), **Exclude the retracted records** removes them from every analysis.
Filters cannot bring them back. They are counted in a "Retracted records removed" row of the PRISMA flow, the decision is logged
with their DOIs, and the reports list them. Projects carry the exclusion to ANCHOR Studio 1.5.3 and back.

## What is in the app

| Area | On the phone |
|---|---|
| Before you start | Researcher, ORCID check, affiliation via ROR (search or e-mail domain), databases and licences, report/code licences |
| Find a focal article | OpenAlex search with filters, shortlist of 10, legal open copies kept on the device, your ticks and notes, fit score, AI summary of abstracts (copy-and-paste or API), retraction warning |
| Start | PDF / Word / text reading on the device (pdf.js), DOI, abstract and reference detection, Crossref look-up, 7 citation styles via doi.org, your edits never overwritten |
| Phases A N C H O R | Questions, draft (copy-and-paste prompts or Claude API with your own key, or manual), the model's questions, quality controls, gate checks, approve / revise / reopen, lessons and live reading suggestions, PRISMA counts (N), focal article in OpenAlex (A), open copies (C), research-front trend (H) |
| Bibliometrics | Import Web of Science plain text, Scopus CSV or the desktop's Biblioshiny .xlsx; OpenAlex corpus (search, citing works, references); the article's own reference list; sample data; filters; retraction check; 37 analyses with figures; add to report; CSV / PNG / SVG; dataset as .xlsx |
| Report & disclosure | HTML report, Word (.docx), LaTeX package for Overleaf, BibTeX, AI-use disclosure, prompt and decision logs, project file; report headings in English or the app's language |
| Languages | English, German, Arabic (right-to-left). AI drafts can be requested in any of the three |

### Not on the phone (use ANCHOR Studio on a computer)
* Phase O econometrics (fixest panels, event studies, metafor, rating disagreement) and the open-data fetchers (World Bank, FRED, SEC, IMF, GDELT …). Datasets and results made on the desktop stay in the project file untouched.
* Bibliometrics: **thematic evolution** and **factorial analysis (MCA)**. BibTeX, Lens and OpenAlex-CSV imports are read by the desktop app.
* PDF export: print the HTML report to PDF, or save the Word report as PDF.
* Ollama (a local model on a computer) — the phone offers copy-and-paste prompts and the Claude API.

## Install

**PWA:** put the `app/` folder on any HTTPS web host (for example GitHub Pages), open it on the phone and choose *Add to Home screen* / *Install app*. After the first visit it works offline. Locally: `cd app && python3 -m http.server 8765`, then open `http://localhost:8765`.

**Android:** install `ANCHOR-Mobile.apk` (allow installing from this source when Android asks). Android 5.0 or newer with an up-to-date Android System WebView (Chrome 80+). Opening a `.anchor` file from Files or a mail app opens it in ANCHOR.

## Privacy and sharing rules (same as the desktop app)
* The article, its text and your review stay on the device (IndexedDB). Live checks send only DOIs and short search terms.
* The Claude API key and the contact e-mail are device settings; they are never written into project files, reports or logs. A key is kept after closing the app only if you tick *Remember the key on this device*.
* Downloaded open-access PDFs stay on the device and are never put in project files, reports or packages.
* Licensed data is never put in project files (licensed datasets from the desktop keep the desktop's rule).
* The project file contains the article's full text: share it only with people allowed to read the article.

## Project files
Projects are R lists saved with `saveRDS` (gzip, XDR v3), read and written by `js/rds.js`. Fields the phone does not
use are written back exactly as they were read. ANCHOR Studio opens projects saved on the phone; it rebuilds
bibliometrix's summary object from the records from version 1.5.2 on. Desktop 1.5.1 also opens them; there, press
*Apply filters* once under Bibliometrics > Data before running analyses.

## Build
```
node build/make_map.js            # world map outlines (Natural Earth via world-atlas)
node build/extract_strings.js     # texts to translate -> build/strings_en.json
node build/assemble_lang.js de    # build/tr/de_*.json -> app/js/lang_de.js (same for ar)
node build/make_sw.js             # offline cache list -> app/sw.js
android/build_apk.sh              # APK (Android SDK build-tools, platform 23, JDK)
```
`build/export_content.R` exports the framework content from ANCHOR Studio's R sources into `app/js/content.js`.
The APK is signed with `android/anchor-release.keystore` (alias `anchor`, password `anchor-mobile`).
**Keep that keystore private and change its password** (`keytool -storepasswd`); updates must be signed with the same key.

## Tests
* `test/compare_biblio.js` — every analysis against bibliometrix 4.3.1 on three datasets: 101 tables identical, 1 near
  (a sign the desktop app showed wrongly; fixed in desktop 1.5.2), Louvain networks differ because Louvain is random in R too.
* `test/compare_tm.js`, `test/compare_net.js` — thematic map, walktrap clusters and network centralities identical to igraph.
* `test/proposal_test.js` — 11 checks of the Proposal / thesis tab, its exports, a Word template and the project round trip.
* `test/e2e.js` — 54 checks on an emulated Pixel 7 with mocked live services: set-up, PDF reading, DOI and styles,
  gates, copy-and-paste and API drafting, all analyses, excluding retracted records, locked approvals, versions and restore, stale figures, OpenAlex corpus, finder, trend, reports, Arabic/German, project round trip.
* `test/rds_roundtrip.js` — desktop project files are re-serialized byte for byte.
* `test/offline_test.js` — the PWA reloads and works offline.

Live services were tested with mocks only. The APK was built and checked with `aapt`/`apksigner` and its JavaScript
bridge simulated in a browser; it has not been run on a physical phone.

## Licences
GPL-3. Bundled software keeps its own licences — see `app/vendor/licenses/NOTICE.txt`. The tribute portrait is
© the Kastour family and not covered by the GPL-3.
