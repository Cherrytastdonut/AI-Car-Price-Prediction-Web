"""Build a compact, real-data comparison dataset for the web API.

The input source is the repository's original CarDekho archive.
Keep the exact-row deduplication consistent with modeling/train_model.py.
"""
import csv
import io
import json
import zipfile
from pathlib import Path

SOURCE = "Car details v3.csv"

with zipfile.ZipFile("archive.zip") as archive:
    with archive.open(SOURCE) as data:
        reader = csv.DictReader(io.TextIOWrapper(data, encoding="utf-8-sig"))
        original = list(reader)

seen = set()
unique = []
for row in original:
    key = tuple(row.items())
    if key not in seen:
        seen.add(key)
        unique.append(row)

fuels = sorted({row["fuel"] for row in unique})
transmissions = sorted({row["transmission"] for row in unique})

records = []
for row in unique:
    records.append([
        int(row["year"]),
        int(row["km_driven"]),
        fuels.index(row["fuel"]),
        transmissions.index(row["transmission"]),
        int(float(row["selling_price"])),
    ])

assert len(original) == 8128, "Unexpected input dataset size"
assert len(records) == 6926, "Deduplication does not match trained-model dataset"

payload = {
    "source": SOURCE,
    "row_count": len(records),
    "overall_average": round(sum(row[4] for row in records) / len(records)),
    "fuels": fuels,
    "transmissions": transmissions,
    "records": records,
}

output = Path("api/comparison-data.js")
output.parent.mkdir(exist_ok=True)
output.write_text(
    "// Generated from Car details v3.csv. Do not edit manually.\n"
    + "export default "
    + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(f"Exported {len(records)} real CarDekho rows to {output}")
print(f"Overall average (INR): {payload['overall_average']}")
