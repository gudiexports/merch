# Merchandising: Merchant's Helper

Single-page Claude artifact for Gudi Exports merchandising.

- `merchants_helper.html` : the page (source of the published artifact, Version 20). Tabs: Build BoM and Label Checker.
- `esera_seed.json` : starting BoM for style 2130638 ESERA, stored in the artifact database as `boms/esera-2130638-v1`.

## Tabs
- **Build BoM**: build BoMs from tech packs (or import a WFX costing PDF), Costing Report layout, PDF and CSV export, filterable list.
- **Label Checker**: checks PO, tech pack, FPT report and the buyer portal tag and wash care layouts against each other and says whether the wash care label and price tag can be ordered. PDF and CSV report.

## Needs
Runs only inside Claude as a published artifact (capabilities: db, user, assets, sample, downloads). pdf.js, jsPDF and jspdf-autotable load from cdnjs.
