import json
import re
import sys

BASE = "apps/traffic-tickets/src/db/data"

with open(f"{BASE}/violation-descriptions.json") as f:
    vd = json.load(f)

with open(f"{BASE}/catalog_categories.json") as f:
    catalog = json.load(f)

# ---- 1. Replicate seed mapping (known_variants -> orig_id) ----
orig_to_cat_idx = {}
for idx, entry in enumerate(catalog):
    for variant in entry["known_variants"]:
        for key, orig_id in vd.items():
            if variant in key:
                orig_to_cat_idx[orig_id] = idx

all_orig_ids = set(vd.values())
unmapped = sorted(all_orig_ids - set(orig_to_cat_idx.keys()))
print(f"Total orig_id: {len(all_orig_ids)}")
print(f"Ja mapeados: {len(orig_to_cat_idx)}")
print(f"Nao mapeados: {len(unmapped)}")

# ---- 2. Manual override: orig_id -> catalog_index ----
MANUAL = {
    57: 14,    # Art.164, c/c Art. 162, Inc.II -> catalog[14]
    71: 17,    # Art. 165 do CTB -> catalog[17]
    90: 26,    # Art. 170 do CTB. (ameacando veiculos) -> catalog[26]
    91: 25,    # Art. 170 do CTB. (ameacando pedestres) -> catalog[25]
    106: 31,   # Art. 173 do CTB -> catalog[31]
    128: 34,   # Art. 175 do CTB -> catalog[34]
}

# ---- 3. Build mapping unmapped -> catalog_idx ----
unmapped_to_cat = {}

for oid in unmapped:
    for key, oid2 in vd.items():
        if oid2 != oid:
            continue
        parts = key.split("|", 2)
        law_code = parts[1] if len(parts) == 3 else parts[0]
        desc = parts[2] if len(parts) == 3 else ""
        found = False

        # 3a. Manual override
        if oid in MANUAL:
            unmapped_to_cat[oid] = MANUAL[oid]
            break

        # 3b. Exact law_code match
        for idx, entry in enumerate(catalog):
            if entry["law_code"] == law_code:
                unmapped_to_cat[oid] = idx
                found = True
                break
        if found:
            break

        # 3c. Remove " do CTB" / " do CTB." / " do CTB," suffix
        cleaned = re.sub(r"\s+do\s+CTB\.?,?\s*$", "", law_code)
        for idx, entry in enumerate(catalog):
            if entry["law_code"] == cleaned:
                unmapped_to_cat[oid] = idx
                found = True
                break
        if found:
            break

        # 3d. Remove " c/c ..." suffix
        cleaned2 = re.sub(r",?\s*c/c\s+.*$", "", law_code)
        for idx, entry in enumerate(catalog):
            if entry["law_code"] == cleaned2:
                unmapped_to_cat[oid] = idx
                found = True
                break
        if found:
            break

        # 3e. Remove trailing newlines/normalize
        cleaned3 = law_code.strip()
        if cleaned3 != law_code:
            for idx, entry in enumerate(catalog):
                if entry["law_code"] == cleaned3:
                    unmapped_to_cat[oid] = idx
                    found = True
                    break
        if found:
            break

        if not found:
            print(f"  WARN: orig_id={oid} NAO mapeado: law_code={law_code} desc={desc[:60]}")

        break

print(f"Mapeados com sucesso: {len(unmapped_to_cat)}/{len(unmapped)}")
not_mapped = set(unmapped) - set(unmapped_to_cat.keys())
if not_mapped:
    print(f"Nao mapeados: {not_mapped}")

# ---- 4. Add descriptions to known_variants ----
additions = 0
already_present = 0

cat_descriptions = {idx: set() for idx in range(len(catalog))}

for oid, cat_idx in unmapped_to_cat.items():
    for key, oid2 in vd.items():
        if oid2 == oid:
            parts = key.split("|", 2)
            desc = parts[2] if len(parts) == 3 else ""
            if desc.strip():
                cat_descriptions[cat_idx].add(desc)
            break

for cat_idx, descriptions in cat_descriptions.items():
    entry = catalog[cat_idx]
    existing = set(entry["known_variants"])
    for desc in descriptions:
        already_matches = any(
            variant in desc or desc in variant for variant in existing
        )
        if not already_matches and desc not in existing:
            entry["known_variants"].append(desc)
            additions += 1
        else:
            already_present += 1

print(f"\nVariantes adicionadas: {additions}")
print(f"Variantes ja presentes: {already_present}")

# ---- 5. Save ----
output_path = f"{BASE}/catalog_categories.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"\nArquivo salvo: {output_path}")
print(f"Total entries no catalogo: {len(catalog)}")

# ---- 6. Final verification ----
orig_to_cat_idx_v2 = {}
for idx, entry in enumerate(catalog):
    for variant in entry["known_variants"]:
        for key, orig_id in vd.items():
            if variant in key:
                orig_to_cat_idx_v2[orig_id] = idx

unmapped_v2 = sorted(all_orig_ids - set(orig_to_cat_idx_v2.keys()))
print(f"\n--- Verificacao final ---")
print(f"Total orig_id: {len(all_orig_ids)}")
print(f"Mapeados apos correcao: {len(orig_to_cat_idx_v2)}")
print(f"Ainda nao mapeados: {len(unmapped_v2)}")
if unmapped_v2:
    for oid in unmapped_v2:
        for key, oid2 in vd.items():
            if oid2 == oid:
                parts = key.split("|", 2)
                lc = parts[1] if len(parts) == 3 else parts[0]
                desc = parts[2][:60] if len(parts) == 3 else ""
                print(f"  orig_id={oid}: {lc} | {desc}")
                break
