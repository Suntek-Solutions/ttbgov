#!/usr/bin/env python3
"""
Download a balanced public label dataset from the TTB COLAs Online registry.

This script collects label images across the three major beverage types:
- distilled_spirits
- wine
- malt_beverage

It saves images under:
  public/test-labels/real/<category>/

and writes a metadata manifest:
  public/test-labels/real/metadata.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.parse import parse_qs, urljoin, urlparse

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://www.ttbonline.gov/colasonline/"
SEARCH_URL = urljoin(BASE_URL, "publicSearchColasBasic.do")
SEARCH_PROCESS_URL = urljoin(BASE_URL, "publicSearchColasBasicProcess.do?action=search")
SORT_DATE_DESC_URL = urljoin(
    BASE_URL, "publicPageBasicCola.do?action=sort&sortcol=dateCompleted&order=desc"
)

PRINTABLE_LINK_RE = re.compile(
    r"viewColaDetails\.do\?action=publicFormDisplay&ttbid=(\d+)", re.IGNORECASE
)

CATEGORY_ORDER = ["distilled_spirits", "wine", "malt_beverage"]

SPIRITS_KEYWORDS = (
    "WHISK",
    "BOURBON",
    "RYE",
    "VODKA",
    "GIN",
    "RUM",
    "TEQUILA",
    "MEZCAL",
    "BRANDY",
    "COGNAC",
    "LIQUEUR",
    "DISTILLED",
    "SPIRIT",
)
WINE_KEYWORDS = (
    "WINE",
    "CHARDONNAY",
    "CABERNET",
    "MERLOT",
    "PINOT",
    "RIESLING",
    "SAUVIGNON",
    "ZINFANDEL",
    "SANGRIA",
    "ROSE",
    "MUSCAT",
    "PORT",
    "SHERRY",
)
MALT_KEYWORDS = (
    "BEER",
    "ALE",
    "LAGER",
    "STOUT",
    "PORTER",
    "PILSNER",
    "IPA",
    "MALT",
)


@dataclass
class Candidate:
    ttbid: str
    completed_date: str
    fanciful_name: str
    brand_name: str
    origin_code: str
    origin_desc: str
    class_type_code: str
    class_type_desc: str
    details_href: str

    @property
    def details_url(self) -> str:
        return urljoin(BASE_URL, self.details_href)

    @property
    def category(self) -> str:
        desc = (self.class_type_desc or "").upper()
        if any(word in desc for word in SPIRITS_KEYWORDS):
            return "distilled_spirits"
        if any(word in desc for word in WINE_KEYWORDS):
            return "wine"
        if any(word in desc for word in MALT_KEYWORDS):
            return "malt_beverage"
        return "other"


def slugify(value: str, max_len: int = 80) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    value = value[:max_len].strip("-")
    return value or "label"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect public labels from COLAs Online")
    parser.add_argument(
        "--min-count",
        type=int,
        default=50,
        help="Minimum number of labels to download (default: 50)",
    )
    parser.add_argument(
        "--from-date",
        default=(date.today() - timedelta(days=365 * 2)).strftime("%m/%d/%Y"),
        help="Search start date in MM/DD/YYYY format (default: 2 years ago)",
    )
    parser.add_argument(
        "--to-date",
        default=date.today().strftime("%m/%d/%Y"),
        help="Search end date in MM/DD/YYYY format (default: today)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=120,
        help="Maximum result pages to scan (default: 120)",
    )
    parser.add_argument(
        "--sleep-ms",
        type=int,
        default=150,
        help="Sleep between requests in milliseconds (default: 150)",
    )
    return parser.parse_args()


def extract_text(cell) -> str:
    return " ".join(cell.get_text(" ", strip=True).split())


def parse_result_candidates(html: str) -> List[Candidate]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.find_all("tr")
    candidates: List[Candidate] = []

    for row in rows:
        link = row.find(
            "a",
            href=lambda href: bool(
                href and "viewColaDetails.do?action=publicDisplaySearchBasic&ttbid=" in href
            ),
        )
        if not link:
            continue
        link_text = extract_text(link)
        if not link_text.isdigit():
            continue
        cells = row.find_all("td")
        if len(cells) < 9:
            continue

        values = [extract_text(cell) for cell in cells]
        if not values or values[0] != link_text:
            continue
        candidate = Candidate(
            ttbid=link_text,
            completed_date=values[3] if len(values) > 3 else "",
            fanciful_name=values[4] if len(values) > 4 else "",
            brand_name=values[5] if len(values) > 5 else "",
            origin_code=values[6] if len(values) > 6 else "",
            origin_desc=values[7] if len(values) > 7 else "",
            class_type_code=values[8] if len(values) > 8 else "",
            class_type_desc=values[9] if len(values) > 9 else "",
            details_href=link["href"],
        )
        candidates.append(candidate)
    return candidates


def find_next_href(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    next_link = soup.find("a", string=lambda s: s and "Next >" in s)
    if not next_link or not next_link.get("href"):
        return None
    return next_link["href"]


def collect_candidates(
    session: requests.Session,
    from_date: str,
    to_date: str,
    max_pages: int,
    sleep_seconds: float,
) -> List[Candidate]:
    session.get(SEARCH_URL, timeout=30, verify=False)

    payload = {
        "searchCriteria.dateCompletedFrom": from_date,
        "searchCriteria.dateCompletedTo": to_date,
        "searchCriteria.productOrFancifulName": "",
        "searchCriteria.productNameSearchType": "E",
        "searchCriteria.classTypeFrom": "",
        "searchCriteria.classTypeTo": "",
        "searchCriteria.originCode": "",
    }
    result = session.post(SEARCH_PROCESS_URL, data=payload, timeout=30, verify=False)
    result.raise_for_status()

    sorted_page = session.get(SORT_DATE_DESC_URL, timeout=30, verify=False)
    sorted_page.raise_for_status()
    html = sorted_page.text

    all_candidates: List[Candidate] = []
    seen: set[str] = set()

    for _ in range(max_pages):
        page_candidates = parse_result_candidates(html)
        if not page_candidates and not all_candidates:
            # Some sessions return the original results page first; use it as fallback.
            page_candidates = parse_result_candidates(result.text)
        for candidate in page_candidates:
            if candidate.ttbid in seen:
                continue
            seen.add(candidate.ttbid)
            all_candidates.append(candidate)

        next_href = find_next_href(html)
        if not next_href:
            break

        time.sleep(sleep_seconds)
        next_resp = session.get(urljoin(BASE_URL, next_href), timeout=30, verify=False)
        next_resp.raise_for_status()
        html = next_resp.text

    return all_candidates


def extract_printable_href(details_html: str, ttbid: str) -> Optional[str]:
    match = PRINTABLE_LINK_RE.search(details_html)
    if not match:
        return None
    href = match.group(0)
    if href.startswith("viewColaDetails"):
        return href
    # Normalized safety fallback
    return f"viewColaDetails.do?action=publicFormDisplay&ttbid={ttbid}"


def extract_attachment_records(printable_html: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(printable_html, "html.parser")
    records: List[Dict[str, str]] = []
    for image in soup.find_all("img"):
        src = image.get("src", "")
        if "publicViewAttachment.do" not in src:
            continue
        alt = image.get("alt", "")
        records.append({"src": src, "alt": alt})
    return records


def choose_best_attachment(records: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    if not records:
        return None
    # Prefer front/brand image to maximize OCR utility.
    for record in records:
        alt_upper = record.get("alt", "").upper()
        if "FRONT" in alt_upper or "BRAND" in alt_upper:
            return record
    return records[0]


def infer_extension_from_attachment_url(attachment_url: str) -> str:
    parsed = urlparse(attachment_url)
    query = parse_qs(parsed.query)
    filename = query.get("filename", [""])[0]
    suffix = Path(filename).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return suffix
    return ".jpg"


def target_distribution(min_count: int) -> Dict[str, int]:
    base = min_count // 3
    remainder = min_count - (base * 3)
    # Spread the remainder starting with spirits, then wine.
    targets = {"distilled_spirits": base, "wine": base, "malt_beverage": base}
    if remainder >= 1:
        targets["distilled_spirits"] += 1
    if remainder >= 2:
        targets["wine"] += 1
    return targets


def should_take_candidate(
    category: str,
    counts: Dict[str, int],
    targets: Dict[str, int],
    total: int,
    min_count: int,
) -> bool:
    if category not in CATEGORY_ORDER:
        return False
    all_targets_met = all(counts[cat] >= targets[cat] for cat in CATEGORY_ORDER)
    if not all_targets_met:
        # Keep category balance strict until each type hits its target.
        return counts[category] < targets[category]
    # After all targets are met, allow extras until minimum is reached.
    return total < min_count


def write_metadata(out_dir: Path, records: List[Dict[str, str]]) -> None:
    metadata_path = out_dir / "metadata.json"
    metadata_path.write_text(json.dumps(records, indent=2), encoding="utf-8")


def run() -> None:
    args = parse_args()
    sleep_seconds = max(args.sleep_ms, 0) / 1000.0

    project_root = Path(__file__).resolve().parents[1]
    out_dir = project_root / "public" / "test-labels" / "real"
    out_dir.mkdir(parents=True, exist_ok=True)
    for category in CATEGORY_ORDER:
        (out_dir / category).mkdir(parents=True, exist_ok=True)

    session = requests.Session()

    print(f"Collecting candidates from {args.from_date} to {args.to_date} ...")
    candidates = collect_candidates(
        session=session,
        from_date=args.from_date,
        to_date=args.to_date,
        max_pages=args.max_pages,
        sleep_seconds=sleep_seconds,
    )
    print(f"Candidate rows discovered: {len(candidates)}")

    targets = target_distribution(args.min_count)
    counts = {category: 0 for category in CATEGORY_ORDER}
    downloaded_ttbids: set[str] = set()
    metadata: List[Dict[str, str]] = []

    total_needed = args.min_count
    for idx, candidate in enumerate(candidates, start=1):
        category = candidate.category
        total_downloaded = len(metadata)
        if total_downloaded >= total_needed and all(
            counts[cat] >= targets[cat] for cat in CATEGORY_ORDER
        ):
            break
        if not should_take_candidate(category, counts, targets, total_downloaded, total_needed):
            continue
        if candidate.ttbid in downloaded_ttbids:
            continue

        try:
            time.sleep(sleep_seconds)
            details_resp = session.get(candidate.details_url, timeout=30, verify=False)
            details_resp.raise_for_status()
            printable_href = extract_printable_href(details_resp.text, candidate.ttbid)
            if not printable_href:
                continue

            time.sleep(sleep_seconds)
            printable_url = urljoin(BASE_URL, printable_href)
            printable_resp = session.get(printable_url, timeout=30, verify=False)
            printable_resp.raise_for_status()

            attachments = extract_attachment_records(printable_resp.text)
            chosen = choose_best_attachment(attachments)
            if not chosen:
                continue

            attachment_url = urljoin(BASE_URL, chosen["src"])
            extension = infer_extension_from_attachment_url(attachment_url)
            brand_slug = slugify(candidate.brand_name, max_len=40)
            class_slug = slugify(candidate.class_type_desc, max_len=30)
            filename = f"{candidate.ttbid}_{brand_slug}_{class_slug}{extension}"
            target_path = out_dir / category / filename
            if target_path.exists():
                continue

            time.sleep(sleep_seconds)
            image_resp = session.get(attachment_url, timeout=30, verify=False)
            image_resp.raise_for_status()
            target_path.write_bytes(image_resp.content)

            downloaded_ttbids.add(candidate.ttbid)
            counts[category] += 1
            metadata.append(
                {
                    "ttbid": candidate.ttbid,
                    "category": category,
                    "completed_date": candidate.completed_date,
                    "brand_name": candidate.brand_name,
                    "fanciful_name": candidate.fanciful_name,
                    "class_type_code": candidate.class_type_code,
                    "class_type_desc": candidate.class_type_desc,
                    "origin_code": candidate.origin_code,
                    "origin_desc": candidate.origin_desc,
                    "details_url": candidate.details_url,
                    "printable_url": printable_url,
                    "attachment_url": attachment_url,
                    "attachment_alt": chosen.get("alt", ""),
                    "local_path": str(target_path.relative_to(project_root)).replace("\\", "/"),
                }
            )
            if len(metadata) % 10 == 0:
                print(
                    f"[{len(metadata):03d}] downloaded | "
                    f"spirits={counts['distilled_spirits']} "
                    f"wine={counts['wine']} "
                    f"malt={counts['malt_beverage']} "
                    f"(row {idx}/{len(candidates)})"
                )
        except requests.RequestException:
            continue

    # If one category could not hit target, backfill until min_count from discovered candidates.
    if len(metadata) < total_needed:
        missing = total_needed - len(metadata)
        print(f"Backfilling remaining {missing} labels from available categories...")
        for candidate in candidates:
            if len(metadata) >= total_needed:
                break
            if candidate.ttbid in downloaded_ttbids:
                continue
            category = candidate.category
            if category not in CATEGORY_ORDER:
                continue
            try:
                time.sleep(sleep_seconds)
                details_resp = session.get(candidate.details_url, timeout=30, verify=False)
                details_resp.raise_for_status()
                printable_href = extract_printable_href(details_resp.text, candidate.ttbid)
                if not printable_href:
                    continue
                printable_url = urljoin(BASE_URL, printable_href)
                time.sleep(sleep_seconds)
                printable_resp = session.get(printable_url, timeout=30, verify=False)
                printable_resp.raise_for_status()
                attachments = extract_attachment_records(printable_resp.text)
                chosen = choose_best_attachment(attachments)
                if not chosen:
                    continue
                attachment_url = urljoin(BASE_URL, chosen["src"])
                extension = infer_extension_from_attachment_url(attachment_url)
                brand_slug = slugify(candidate.brand_name, max_len=40)
                class_slug = slugify(candidate.class_type_desc, max_len=30)
                filename = f"{candidate.ttbid}_{brand_slug}_{class_slug}{extension}"
                target_path = out_dir / category / filename
                if target_path.exists():
                    continue
                time.sleep(sleep_seconds)
                image_resp = session.get(attachment_url, timeout=30, verify=False)
                image_resp.raise_for_status()
                target_path.write_bytes(image_resp.content)
                downloaded_ttbids.add(candidate.ttbid)
                counts[category] += 1
                metadata.append(
                    {
                        "ttbid": candidate.ttbid,
                        "category": category,
                        "completed_date": candidate.completed_date,
                        "brand_name": candidate.brand_name,
                        "fanciful_name": candidate.fanciful_name,
                        "class_type_code": candidate.class_type_code,
                        "class_type_desc": candidate.class_type_desc,
                        "origin_code": candidate.origin_code,
                        "origin_desc": candidate.origin_desc,
                        "details_url": candidate.details_url,
                        "printable_url": printable_url,
                        "attachment_url": attachment_url,
                        "attachment_alt": chosen.get("alt", ""),
                        "local_path": str(target_path.relative_to(project_root)).replace("\\", "/"),
                    }
                )
            except requests.RequestException:
                continue

    write_metadata(out_dir, metadata)

    total = len(metadata)
    print("\nDone.")
    print(f"Total downloaded: {total}")
    print(
        "By category: "
        f"distilled_spirits={counts['distilled_spirits']}, "
        f"wine={counts['wine']}, "
        f"malt_beverage={counts['malt_beverage']}"
    )
    print(f"Metadata: {out_dir / 'metadata.json'}")
    if total < args.min_count:
        print(
            f"WARNING: Requested at least {args.min_count}, but only downloaded {total}. "
            "Try expanding date range or max-pages."
        )


if __name__ == "__main__":
    run()
