#!/usr/bin/env python3
"""Build data/wars/conflicts.json from the English Wikipedia war lists.

Direct belligerents only. Flags under Support / Supported by / Alleged, and
countries tucked inside collapsible coalition lists, stay off the map.
"""

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "wars" / "conflicts.json"
WORLD_OUT = ROOT / "data" / "world-countries.json"
LISTS = [
    "List of wars: 2003–2019",
    "List of wars: 2020–present",
]
UA = "Plotmaniac/1.0 (war map; educational)"

# Preferred display name, then extra flag labels that mean the same state.
STATES = {
    "US": ("United States", ["USA", "United States of America"]),
    "GB": ("United Kingdom", ["UK", "Great Britain", "Britain"]),
    "AU": ("Australia", []),
    "PL": ("Poland", []),
    "IQ": ("Iraq", ["Ba'athist Iraq", "Republic of Iraq"]),
    "SD": ("Sudan", []),
    "SS": ("South Sudan", []),
    "TD": ("Chad", []),
    "LY": ("Libya", []),
    "CN": ("China", ["People's Republic of China", "PRC"]),
    "IR": ("Iran", ["Islamic Republic of Iran"]),
    "RU": ("Russia", ["Russian Federation"]),
    "BY": ("Belarus", []),
    "SY": ("Syria", ["Ba'athist Syria", "Syrian Arab Republic"]),
    "TH": ("Thailand", []),
    "MY": ("Malaysia", []),
    "ID": ("Indonesia", []),
    "QA": ("Qatar", []),
    "BH": ("Bahrain", []),
    "TR": ("Turkey", ["Türkiye", "Turkiye"]),
    "DE": ("Germany", []),
    "NZ": ("New Zealand", []),
    "CA": ("Canada", []),
    "PK": ("Pakistan", []),
    "CD": ("Democratic Republic of the Congo", ["DR Congo", "DRC", "Zaire", "Congo-Kinshasa"]),
    "CG": ("Republic of the Congo", ["Congo-Brazzaville"]),
    "AO": ("Angola", []),
    "ZW": ("Zimbabwe", []),
    "BW": ("Botswana", []),
    "FR": ("France", []),
    "BE": ("Belgium", []),
    "BG": ("Bulgaria", []),
    "AF": ("Afghanistan", ["Islamic Republic of Afghanistan", "Islamic Emirate of Afghanistan"]),
    "IN": ("India", []),
    "PS": ("Palestine", ["Gaza Strip", "State of Palestine", "West Bank", "Palestinian Authority"]),
    "IL": ("Israel", []),
    "LB": ("Lebanon", []),
    "ET": ("Ethiopia", ["ETH"]),
    "ER": ("Eritrea", []),
    "EG": ("Egypt", ["EGY"]),
    "AE": ("United Arab Emirates", ["UAE"]),
    "SA": ("Saudi Arabia", []),
    "SN": ("Senegal", []),
    "MA": ("Morocco", []),
    "KW": ("Kuwait", []),
    "YE": ("Yemen", ["Republic of Yemen"]),
    "UA": ("Ukraine", []),
    "KP": ("North Korea", ["DPRK", "Democratic People's Republic of Korea"]),
    "KR": ("South Korea", ["Republic of Korea"]),
    "AM": ("Armenia", []),
    "AZ": ("Azerbaijan", []),
    "GE": ("Georgia", []),
    "EH": ("Western Sahara", ["Sahrawi Arab Democratic Republic"]),
    "GH": ("Ghana", []),
    "NG": ("Nigeria", []),
    "NE": ("Niger", []),
    "ML": ("Mali", []),
    "BF": ("Burkina Faso", []),
    "MR": ("Mauritania", []),
    "SO": ("Somalia", []),
    "KE": ("Kenya", []),
    "UG": ("Uganda", []),
    "RW": ("Rwanda", []),
    "BI": ("Burundi", []),
    "TZ": ("Tanzania", []),
    "MZ": ("Mozambique", []),
    "ZA": ("South Africa", []),
    "NA": ("Namibia", []),
    "ZM": ("Zambia", []),
    "MW": ("Malawi", []),
    "LS": ("Lesotho", []),
    "SZ": ("Eswatini", ["Swaziland"]),
    "MG": ("Madagascar", []),
    "CM": ("Cameroon", []),
    "CF": ("Central African Republic", []),
    "GA": ("Gabon", []),
    "GQ": ("Equatorial Guinea", []),
    "ST": ("São Tomé and Príncipe", ["Sao Tome and Principe"]),
    "CI": ("Ivory Coast", ["Côte d'Ivoire", "Cote d'Ivoire"]),
    "LR": ("Liberia", []),
    "SL": ("Sierra Leone", []),
    "GN": ("Guinea", []),
    "GW": ("Guinea-Bissau", []),
    "GM": ("Gambia", ["The Gambia"]),
    "BJ": ("Benin", []),
    "TG": ("Togo", []),
    "DJ": ("Djibouti", []),
    "KM": ("Comoros", []),
    "HT": ("Haiti", []),
    "JM": ("Jamaica", []),
    "BZ": ("Belize", []),
    "BS": ("Bahamas", ["The Bahamas"]),
    "GT": ("Guatemala", []),
    "SV": ("El Salvador", []),
    "HN": ("Honduras", []),
    "NI": ("Nicaragua", []),
    "CR": ("Costa Rica", []),
    "PA": ("Panama", []),
    "MX": ("Mexico", []),
    "CU": ("Cuba", []),
    "DO": ("Dominican Republic", []),
    "CO": ("Colombia", []),
    "VE": ("Venezuela", []),
    "EC": ("Ecuador", []),
    "PE": ("Peru", []),
    "BO": ("Bolivia", []),
    "BR": ("Brazil", []),
    "PY": ("Paraguay", []),
    "AR": ("Argentina", []),
    "CL": ("Chile", []),
    "UY": ("Uruguay", []),
    "GY": ("Guyana", []),
    "SR": ("Suriname", []),
    "IT": ("Italy", []),
    "ES": ("Spain", []),
    "PT": ("Portugal", []),
    "NL": ("Netherlands", ["Kingdom of the Netherlands"]),
    "NO": ("Norway", []),
    "SE": ("Sweden", []),
    "FI": ("Finland", []),
    "DK": ("Denmark", []),
    "IS": ("Iceland", []),
    "IE": ("Ireland", []),
    "GR": ("Greece", []),
    "RO": ("Romania", []),
    "HU": ("Hungary", []),
    "CZ": ("Czech Republic", ["Czechia"]),
    "SK": ("Slovakia", []),
    "AT": ("Austria", []),
    "CH": ("Switzerland", []),
    "RS": ("Serbia", []),
    "HR": ("Croatia", []),
    "BA": ("Bosnia and Herzegovina", []),
    "ME": ("Montenegro", []),
    "MK": ("North Macedonia", ["Macedonia"]),
    "AL": ("Albania", []),
    "XK": ("Kosovo", []),
    "SI": ("Slovenia", []),
    "EE": ("Estonia", []),
    "LV": ("Latvia", []),
    "LT": ("Lithuania", []),
    "MD": ("Moldova", []),
    "KG": ("Kyrgyzstan", ["Kyrgyz"]),
    "TJ": ("Tajikistan", []),
    "UZ": ("Uzbekistan", []),
    "TM": ("Turkmenistan", []),
    "KZ": ("Kazakhstan", []),
    "MN": ("Mongolia", []),
    "JP": ("Japan", []),
    "TW": ("Taiwan", ["Republic of China"]),
    "PH": ("Philippines", []),
    "VN": ("Vietnam", ["Viet Nam"]),
    "LA": ("Laos", []),
    "KH": ("Cambodia", []),
    "MM": ("Myanmar", ["Burma"]),
    "BD": ("Bangladesh", []),
    "NP": ("Nepal", []),
    "LK": ("Sri Lanka", []),
    "BT": ("Bhutan", []),
    "MV": ("Maldives", []),
    "JO": ("Jordan", []),
    "OM": ("Oman", []),
    "TN": ("Tunisia", []),
    "DZ": ("Algeria", []),
    "MA": ("Morocco", []),
    "CY": ("Cyprus", []),
    "VA": ("Vatican City", ["Holy See"]),
    "TL": ("Timor-Leste", ["East Timor"]),
}

ORGS = {
    "NATO", "United Nations", "European Union", "EU", "EAC", "UAR",
    "UN", "African Union", "AU", "ECOWAS", "Arab League",
}

SKIP_GROUPS = ORGS | {
    "Support", "Participants", "name", "size",
}


def alias_index():
    index = {}
    for iso, (name, extras) in STATES.items():
        index[name.lower()] = iso
        for extra in extras:
            index[extra.lower()] = iso
    return index


ALIASES = alias_index()
ISO_NAME = {iso: name for iso, (name, _) in STATES.items()}


def fetch_wikitext(title):
    cache = Path("/tmp") / ("wiki-" + re.sub(r"[^a-z0-9]+", "-", title.lower()) + ".txt")
    if cache.exists():
        return cache.read_text()
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "parse",
        "page": title,
        "prop": "wikitext",
        "format": "json",
        "formatversion": "2",
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.load(response)
    text = payload["parse"]["wikitext"]
    cache.write_text(text)
    return text


def strip_refs(text):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref\b[^>]*/>", "", text)
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"<ref\b[^>]*>.*?</ref>", "", text, flags=re.S)
    return text


def drop_balanced(text, open_re):
    """Remove template blocks whose start matches open_re, respecting braces."""
    pattern = re.compile(open_re, re.I)
    out = []
    index = 0
    while index < len(text):
        match = pattern.search(text, index)
        if not match:
            out.append(text[index:])
            break
        out.append(text[index:match.start()])
        depth = 0
        cursor = match.start()
        while cursor < len(text):
            if text.startswith("{{", cursor):
                depth += 1
                cursor += 2
                continue
            if text.startswith("}}", cursor):
                depth -= 1
                cursor += 2
                if depth <= 0:
                    break
                continue
            cursor += 1
        index = cursor
    return "".join(out)


def prepare_row(row):
    row = strip_refs(row)
    row = drop_balanced(row, r"\{\{\s*efn\b")
    row = drop_balanced(row, r"\{\{\s*Efn\b")
    row = drop_balanced(row, r"\{\{\s*sfn\b")
    return row


def cells_of(row):
    cells = []
    buf = []
    depth = 0
    link = 0
    index = 0
    while index < len(row):
        if row.startswith("{{", index):
            depth += 1
            buf.append("{{")
            index += 2
            continue
        if row.startswith("}}", index) and depth:
            depth -= 1
            buf.append("}}")
            index += 2
            continue
        if row.startswith("[[", index):
            link += 1
            buf.append("[[")
            index += 2
            continue
        if row.startswith("]]", index) and link:
            link -= 1
            buf.append("]]")
            index += 2
            continue
        if row[index] == "\n" and depth == 0 and link == 0:
            nxt = index + 1
            if nxt < len(row) and row[nxt] == "|" and not row.startswith("|-", nxt) and not row.startswith("|}", nxt):
                cells.append("".join(buf))
                buf = []
                index = nxt + 1
                continue
        buf.append(row[index])
        index += 1
    if buf:
        cells.append("".join(buf))
    return [cell.strip() for cell in cells if cell.strip()]


TOKEN_RE = re.compile(
    r"\{\{\s*(?P<kind>#invoke:flag|flagdeco|flagicon(?!\s*image)|flagcountry|flagu|flag|armed forces|army|navy|air force|coast guard|flag decoration)\s*(?:\|+\s*)(?P<name>[^|}]+)"
    r"|\{\{(?P<iso3>UGA|RWA|BDI|ETH|EGY|SDN|COD|LBY)\}\}",
    re.I,
)
LINK_RE = re.compile(r"\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]")
SUPPORT_RE = re.compile(
    r"(?im)^(?:;|\*\s*)?\s*'*\s*(?:alleged support(?:\s+by)?|supported by|former support|foreign support|support)\b"
)
ISO3 = {
    "UGA": "UG", "RWA": "RW", "BDI": "BI", "ETH": "ET", "EGY": "EG",
    "SDN": "SD", "COD": "CD", "LBY": "LY",
}
# A non-state party that stands in for a country when no state flag is on that side.
GROUP_STATE = {
    "Hamas": "PS",
    "Hezbollah": "LB",
}


def primary_flags(cell):
    text = drop_balanced(cell, r"\{\{\s*Collapsible list\b")
    text = drop_balanced(text, r"\{\{\s*collapsable list\b")
    text = drop_balanced(text, r"\{\{\s*unbulleted list\b")
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    found = []
    for chunk in re.split(r"\n----\n|\n----", text):
        lines = []
        for line in chunk.splitlines():
            if SUPPORT_RE.search(line.strip()):
                break
            lines.append(line)
        piece = "\n".join(lines)
        for match in TOKEN_RE.finditer(piece):
            if match.group("iso3"):
                name = ISO3[match.group("iso3").upper()]
                kind = "iso"
            else:
                name = re.sub(r"\s+", " ", match.group("name")).strip()
                kind = match.group("kind").lower()
            if not name or name.lower() in {item.lower() for item in SKIP_GROUPS}:
                continue
            tail = piece[match.end():match.end() + 160]
            link = LINK_RE.search(tail)
            link_name = ""
            if link and tail[:link.start()].strip(" \n'*:") == "":
                link_name = (link.group(2) or link.group(1)).strip()
                link_target = link.group(1).strip()
            else:
                link_target = ""
            if kind == "flagicon" and not ALIASES.get(link_target.lower()) and not ALIASES.get(link_name.lower()):
                label = link_name or link_target
                if label and label not in found:
                    found.append(label)
                continue
            if kind in {"flagdeco", "flag decoration"} and not ALIASES.get(name.lower()):
                if ALIASES.get(link_name.lower()) or ALIASES.get(link_target.lower()):
                    name = link_name or link_target
                else:
                    continue
            if name not in found:
                found.append(name)
    return found


def classify(names):
    states = []
    groups = []
    for name in names:
        iso = name if name in STATES else ALIASES.get(name.lower())
        if iso:
            if iso not in states:
                states.append(iso)
            continue
        if name in SKIP_GROUPS or name.lower() in {item.lower() for item in SKIP_GROUPS}:
            continue
        if name not in groups:
            groups.append(name)
    if not states:
        for group in groups:
            iso = GROUP_STATE.get(group)
            if iso and iso not in states:
                states.append(iso)
    return {"states": states, "groups": groups[:8]}


def wiki_url(title):
    slug = title.replace(" ", "_")
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(slug, safe="/()_-:,'")


def slugify(title):
    text = title.lower().replace("–", "-").replace("—", "-").replace("'", "")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:72] or "war"


def tables(wt):
    found = []
    for match in re.finditer(r"\{\|", wt):
        rest = wt[match.end():]
        close = re.search(r"\n\|\}", rest)
        if not close:
            continue
        body = rest[:close.start()]
        if "Name of conflict" in body[:1500]:
            found.append(body)
    return found


# Hand fixes where a Wikipedia column mixes sponsors, phases, or rival factions
# into one side. Each entry replaces the parsed sides for that article title.
OVERRIDES = {
    "Iraq War": [
        {"states": ["US", "GB", "AU", "PL"], "groups": []},
        {"states": ["IQ"], "groups": []},
    ],
    "Kivu conflict": [
        {"states": ["CD"], "groups": []},
        {"states": ["RW", "UG"], "groups": []},
    ],
    "Somali Civil War (2009–present)": [
        {"states": ["SO"], "groups": ["Al-Shabaab"]},
    ],
    "South Sudanese Civil War": [
        {"states": ["SS", "UG"], "groups": []},
    ],
    "Libyan civil war (2014–2020)": [
        {"states": ["LY", "EG", "AE"], "groups": []},
        {"states": ["TR"], "groups": []},
    ],
    "Russo-Ukrainian War": [
        {"states": ["RU"], "groups": []},
        {"states": ["UA"], "groups": []},
    ],
    "Yemeni civil war (2014–present)": [
        {"states": ["YE", "SA", "AE"], "groups": []},
        {"states": [], "groups": ["Houthis"]},
    ],
    "North Kosovo crisis": [
        {"states": ["XK"], "groups": []},
        {"states": ["RS"], "groups": []},
    ],
    "2024 Syrian opposition offensives": [
        {"states": [], "groups": ["Syrian opposition"]},
        {"states": ["SY", "RU", "IR"], "groups": ["Hezbollah"]},
    ],
    "Gang war in Haiti": [
        {"states": ["HT"], "groups": ["Armed gangs"]},
    ],
}


def conflicts_from(wt):
    rows = []
    for body in tables(wt):
        for row in re.split(r"\n\|-", body)[1:]:
            row = prepare_row(row)
            cells = cells_of(row)
            if len(cells) < 3:
                continue
            start_match = re.search(r"(20\d{2}|19\d{2})", cells[0])
            if not start_match:
                continue
            link = re.search(r"\[\[([^|\]#]+)(?:\|([^\]]+))?\]\]", cells[2])
            if not link:
                continue
            target = link.group(1).strip()
            label = re.sub(r"''.*?''", "", link.group(2) or target)
            label = re.sub(r"<[^>]+>", "", label).strip() or target
            end_raw = re.sub(r"<[^>]+>", "", cells[1])
            if re.search(r"(?i)ongoing|present", end_raw):
                end = None
            else:
                end_match = re.search(r"(20\d{2}|19\d{2})", end_raw)
                end = int(end_match.group(1)) if end_match else None
            sides = []
            for cell in cells[3:]:
                flags = primary_flags(cell)
                if not flags:
                    continue
                side = classify(flags)
                if side["states"] or side["groups"]:
                    sides.append(side)
            override = OVERRIDES.get(target) or OVERRIDES.get(label)
            if override:
                sides = override
            rows.append({
                "name": label,
                "wiki": target,
                "start": int(start_match.group(1)),
                "end": end,
                "sides": sides,
            })
    return rows


def dedupe(rows):
    seen = {}
    kept = []
    for row in rows:
        key = row["wiki"].lower()
        if key in seen:
            continue
        seen[key] = True
        base = slugify(row["wiki"])
        ident = base
        taken = {item["id"] for item in kept}
        if ident in taken:
            ident = f"{base}-{row['start']}"
        wikipedia = wiki_url(row["wiki"])
        kept.append({
            "id": ident,
            "name": row["name"],
            "start": row["start"],
            "end": row["end"],
            "wikipedia": wikipedia,
            "sides": row["sides"],
        })
    kept.sort(key=lambda item: (item["start"], item["name"].lower()))
    return kept


def used_countries(conflicts):
    found = {}
    for conflict in conflicts:
        for side in conflict["sides"]:
            for iso in side["states"]:
                found[iso] = {"name": ISO_NAME[iso]}
    return dict(sorted(found.items()))


def slim_world():
    source = Path("/tmp/ne_110m.geojson")
    if not source.exists():
        url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        source.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    raw = json.loads(source.read_text())
    iso_fix = {
        "France": "FR",
        "Norway": "NO",
        "Kosovo": "XK",
        "Taiwan": "TW",
    }

    def rnd(coords):
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], 2), round(coords[1], 2)]
        return [rnd(part) for part in coords]

    features = []
    for feature in raw["features"]:
        props = feature["properties"]
        admin = props.get("ADMIN") or props.get("NAME")
        iso = props.get("ISO_A2")
        if not iso or iso == "-99":
            iso = iso_fix.get(admin)
        if not iso or iso == "-99":
            continue
        if admin == "Taiwan":
            iso = "TW"
        features.append({
            "type": "Feature",
            "properties": {"iso": iso, "name": ISO_NAME.get(iso, props.get("NAME") or admin)},
            "geometry": {
                "type": feature["geometry"]["type"],
                "coordinates": rnd(feature["geometry"]["coordinates"]),
            },
        })
    WORLD_OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"world {WORLD_OUT} features {len(features)} bytes {WORLD_OUT.stat().st_size}")


def main():
    rows = []
    for title in LISTS:
        print("fetch", title)
        rows.extend(conflicts_from(fetch_wikitext(title)))
    conflicts = dedupe(rows)
    payload = {"countries": used_countries(conflicts), "conflicts": conflicts}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    paired = 0
    empty = 0
    for conflict in conflicts:
        sides = [side["states"] for side in conflict["sides"] if side["states"]]
        if len(sides) < 2:
            empty += 1
        else:
            paired += 1
    print(f"conflicts {len(conflicts)} with interstate sides {paired} without {empty}")
    slim_world()


if __name__ == "__main__":
    main()
