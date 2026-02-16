# Importing list data (LIST.xlsx) into Solar EPC

## CSV is best for import

- **I can’t read .xlsx** in this environment (binary format).
- **CSV works well**: plain text, easy to parse, and we can run an import script against it.

### Option A: Export from Excel

1. Open **LIST-.xlsx** (or your LIST.xlsx) in Excel.
2. **File → Save As** (or **Export**) → choose **CSV (Comma delimited) (*.csv)**.
3. Save as **`list.csv`** in the project root: `/opt/solar-epc/list.csv`  
   Or put it in a folder, e.g. **`/opt/solar-epc/data/list.csv`**.

### Option B: Google Sheet → CSV

1. Upload your list to Google Sheets (or create a sheet with the same columns).
2. **File → Download → Comma-separated values (.csv)**.
3. Save the file as **`list.csv`** in the project (e.g. `/opt/solar-epc/list.csv` or `/opt/solar-epc/data/list.csv`).

Then run the import script (see below). Either option is fine; **CSV in the project** is what the script needs.

---

## Expected columns (surveys)

The import maps CSV columns into **surveys**. Approximate mapping (header names can vary; the script tries to match flexibly):

| CSV column (examples)     | Maps to survey field   |
|---------------------------|------------------------|
| Consumer Name / Name       | beneficiary_name       |
| Service No / Service Number | service_no           |
| Aadhaar / AADHAAR         | aadhar_no              |
| Mobile / MOBILE           | mobile                 |
| Contracted Load            | contracted_load        |
| CIRCLE                     | site_location.circle   |
| DIVISION                   | site_location.division |
| SUB DIVISION               | site_location.subDivision |
| SECTION                    | site_location.section |
| District / DISTRICT        | site_location.district |
| Pin Code / PINCODE         | site_location.pinCode |

If your CSV has different headers, add the file and tell me the exact header row (or paste the first line); we can adjust the script.

---

## Run the import

After `list.csv` is in the project:

```bash
cd /opt/solar-epc
node scripts/import-list-csv.mjs
```

By default the script looks for **`list.csv`** in the project root. To use another path:

```bash
node scripts/import-list-csv.mjs data/list.csv
```

It will insert rows into **Supabase** (table **surveys**). Ensure `.env.local` is set and Supabase is running.
