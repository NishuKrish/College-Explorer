"""Build public campus map points from the existing seed snapshot."""
import csv
import json
from pathlib import Path
root = Path(__file__).resolve().parents[3]
with (root / "data/seed/schools_seed.csv").open() as source:
    points = [{"unitid": int(row["unitid"]), "name": row["name"], "lat": float(row["latitude"]), "lng": float(row["longitude"])}
              for row in csv.DictReader(source) if row["latitude"] and row["longitude"]]
(root / "apps/web/data/campus-coordinates.json").write_text(json.dumps(points, indent=2) + "\n")
