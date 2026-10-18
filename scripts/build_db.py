#!/usr/bin/env python3
"""Build public/foods.sqlite3 from USDA FoodData Central CSV downloads.

Sources (public domain, U.S. Department of Agriculture, Agricultural Research Service):
  * SR Legacy (April 2018)             FoodData_Central_sr_legacy_food_csv_2018-04.zip
  * Foundation Foods (April 2026)      FoodData_Central_foundation_food_csv_2026-04-30.zip
  https://fdc.nal.usda.gov/download-datasets

Usage: python3 scripts/build_db.py [--src DIR] [--out public/foods.sqlite3]
Zips are downloaded into DIR (default .fdc-cache/) if not already present.

The DB is laid out for sql.js-httpvfs (HTTP range requests): page_size 4096,
FTS5 search table that answers queries without touching the main table,
WITHOUT ROWID tables clustered by lookup key, then VACUUM.
"""
import argparse, csv, glob, io, os, sqlite3, sys, urllib.request, zipfile

DATASETS = [
    # (zip name, data_type, src code, label)
    ("FoodData_Central_sr_legacy_food_csv_2018-04", "sr_legacy_food", 0, "SR Legacy 2018-04"),
    ("FoodData_Central_foundation_food_csv_2026-04-30", "foundation_food", 1, "Foundation Foods 2026-04-30"),
]
BASE_URL = "https://fdc.nal.usda.gov/fdc-datasets/"

# column -> list of acceptable nutrient_nbr values in preference order (g/100 g; kcal/100 g)
COLS = {
    "kcal": ["208", "958", "957"],
    "protein": ["203"],
    "fat": ["204", "298"],
    "carbs": ["205", "205.2"],
    "fiber": ["291"],
    "sugars": ["269", "269.3"],
    "water": ["255"],
    "trp": ["501"], "thr": ["502"], "ile": ["503"], "leu": ["504"], "lys": ["505"],
    "met": ["506"], "cys": ["507"], "phe": ["508"], "tyr": ["509"], "val": ["510"], "his": ["512"],
}
EAA = ["trp", "thr", "ile", "leu", "lys", "met", "phe", "val", "his"]
csv.field_size_limit(10**9)


def ensure(src, name):
    d = os.path.join(src, name)
    if glob.glob(os.path.join(d, "*", "food.csv")) or glob.glob(os.path.join(d, "food.csv")):
        return d
    z = os.path.join(src, name + ".zip")
    if not os.path.exists(z):
        print("downloading", BASE_URL + name + ".zip", file=sys.stderr)
        os.makedirs(src, exist_ok=True)
        urllib.request.urlretrieve(BASE_URL + name + ".zip", z)
    zipfile.ZipFile(z).extractall(d)
    return d


def table(d, fn):
    p = glob.glob(os.path.join(d, "**", fn), recursive=True)[0]
    return csv.DictReader(open(p, encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=".fdc-cache")
    ap.add_argument("--out", default="public/foods.sqlite3")
    a = ap.parse_args()

    foods, cats, portions = {}, {}, []
    for name, dtype, code, label in DATASETS:
        d = ensure(a.src, name)
        nbr = {r["id"]: r["nutrient_nbr"] for r in table(d, "nutrient.csv")}
        for r in table(d, "food_category.csv"):
            cats[int(r["id"])] = r["description"]
        mine = {}
        for r in table(d, "food.csv"):
            if r["data_type"] == dtype:
                mine[r["fdc_id"]] = {"name": r["description"].strip(), "cat": int(r["food_category_id"] or 0), "src": code, "v": {}}
        for r in table(d, "food_nutrient.csv"):
            f = mine.get(r["fdc_id"])
            if f is None or r["amount"] == "":
                continue
            f["v"][nbr.get(r["nutrient_id"])] = float(r["amount"])
        units = {r["id"]: r["name"] for r in table(d, "measure_unit.csv")}
        for r in table(d, "food_portion.csv"):
            if r["fdc_id"] not in mine or not r["gram_weight"]:
                continue
            g = float(r["gram_weight"])
            if g <= 0:
                continue
            amt = r.get("amount") or ""
            amt = ("%g" % float(amt)) if amt else ""
            unit = units.get(r.get("measure_unit_id"), "")
            unit = "" if unit in ("undetermined", "") else unit
            desc = (r.get("portion_description") or "").strip()
            mod = (r.get("modifier") or "").strip()
            if desc and desc.lower() not in ("quantity not specified",):
                lab = desc
            else:
                lab = " ".join(x for x in [amt, unit, mod] if x).strip()
            if not lab:
                continue
            portions.append((int(r["fdc_id"]), int(r["seq_num"]) if (r.get("seq_num") or "").isdigit() else 0, lab[:80], round(g, 2)))
        for k, f in mine.items():
            foods[int(k)] = f
        print(label, "foods:", len(mine), file=sys.stderr)

    if os.path.exists(a.out):
        os.remove(a.out)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    db = sqlite3.connect(a.out)
    db.executescript("""
    PRAGMA page_size=4096; PRAGMA journal_mode=DELETE;
    CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
    CREATE TABLE categories(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE foods(
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, cat INTEGER, src INTEGER, has_aa INTEGER,
      kcal REAL, protein REAL, fat REAL, carbs REAL, fiber REAL, sugars REAL, water REAL,
      trp REAL, thr REAL, ile REAL, leu REAL, lys REAL, met REAL, cys REAL, phe REAL, tyr REAL, val REAL, his REAL);
    CREATE TABLE portions(fdc_id INTEGER, seq INTEGER, label TEXT, grams REAL, PRIMARY KEY(fdc_id, seq, label)) WITHOUT ROWID;
    -- standalone FTS5 table: search results (name, category, has-AA flag) come entirely from it
    CREATE VIRTUAL TABLE foods_fts USING fts5(name, flags, cat UNINDEXED,
      tokenize='unicode61 remove_diacritics 2', prefix='2 3');
    """)
    db.executemany("INSERT INTO categories VALUES(?,?)", sorted(cats.items()))
    rows, nfull = [], 0
    for fid in sorted(foods):
        f = foods[fid]
        vals = {}
        for col, keys in COLS.items():
            vals[col] = next((round(f["v"][k], 4) for k in keys if k in f["v"]), None)
        has = int(all(vals[c] is not None for c in EAA))
        nfull += has
        rows.append((fid, f["name"], f["cat"], f["src"], has, *[vals[c] for c in COLS]))
    db.executemany("INSERT INTO foods VALUES(%s)" % ",".join("?" * (5 + len(COLS))), rows)
    db.executemany("INSERT INTO foods_fts(rowid,name,flags,cat) VALUES(?,?,?,?)",
                   [(r[0], r[1], "aa" if r[4] else "", r[2]) for r in rows])
    db.executemany("INSERT OR IGNORE INTO portions VALUES(?,?,?,?)", portions)
    meta = {
        "source": "USDA FoodData Central (public domain): " + "; ".join(d[3] for d in DATASETS),
        "source_url": "https://fdc.nal.usda.gov/",
        "foods": str(len(rows)), "foods_with_eaa": str(nfull),
        "units": "g per 100 g edible portion (kcal per 100 g for energy)",
    }
    db.executemany("INSERT INTO meta VALUES(?,?)", meta.items())
    db.commit()
    db.execute("INSERT INTO foods_fts(foods_fts) VALUES('optimize')")
    db.commit()
    db.execute("VACUUM")
    db.close()
    print("wrote", a.out, os.path.getsize(a.out), "bytes;", len(rows), "foods,", nfull, "with all 9 EAA,", len(portions), "portions", file=sys.stderr)


if __name__ == "__main__":
    main()
