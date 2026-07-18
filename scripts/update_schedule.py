#!/usr/bin/env python3
"""Refresh Capital athlete registrations and first-bout data from IBJJF."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "data" / "schedule.json"
DEFAULT_OVERRIDES = ROOT / "config" / "schedule-overrides.json"
USER_AGENT = "CapitalMatCalls/1.0 (+team schedule updater)"
CLASS_TOKEN = "contains(concat(' ', normalize-space(@class), ' '), ' %s ')"

EVENTS = {
    "Gi": {
        "event_id": 3231,
        "athletes_url": "https://ibjjf.com/events/3231/athletes-list-by-academy-teams",
        "schedule_url": "https://www.bjjcompsystem.com/tournaments/3231/schedule",
        "single_url": "https://www.bjjcompsystem.com/tournaments/3231/single_competitors",
        "dates": {"Saturday": "2026-07-18", "Sunday": "2026-07-19", "Sat": "2026-07-18", "Sun": "2026-07-19", "Sáb": "2026-07-18", "Dom": "2026-07-19"},
    },
    "No-Gi": {
        "event_id": 3232,
        "athletes_url": "https://ibjjf.com/events/3232/athletes-list-by-academy-teams",
        "schedule_url": "https://www.bjjcompsystem.com/tournaments/3232/schedule",
        "single_url": "https://www.bjjcompsystem.com/tournaments/3232/single_competitors",
        "dates": {"Saturday": "2026-07-18", "Sunday": "2026-07-19", "Sat": "2026-07-18", "Sun": "2026-07-19", "Sáb": "2026-07-18", "Dom": "2026-07-19"},
    },
}


class UpdateError(RuntimeError):
    pass


def text_content(node: Any) -> str:
    if node is None:
        return ""
    return " ".join(" ".join(node.itertext()).split())


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(value.casefold().split())


def class_xpath(name: str) -> str:
    return CLASS_TOKEN % name


def fetch(url: str, attempts: int = 3) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=35) as response:
                if response.status != 200:
                    raise UpdateError(f"Unexpected HTTP {response.status} for {url}")
                payload = response.read()
                if len(payload) < 5_000:
                    raise UpdateError(f"Suspiciously short response from {url}")
                return payload
        except (HTTPError, URLError, TimeoutError, UpdateError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1.5 * (attempt + 1))
    raise UpdateError(f"Unable to fetch {url}: {last_error}")


def parse_registrations(payload: bytes) -> list[dict[str, str]]:
    tree = html.fromstring(payload)
    registrations: list[dict[str, str]] = []
    for section in tree.xpath(f"//*[{class_xpath('academy-set')}]"):
        academy = section.get("data-academy-name", "").strip()
        if not academy:
            academy = text_content((section.xpath(f".//*[{class_xpath('academy-name')}]") or [None])[0])
        for row in section.xpath(".//tbody/tr"):
            category = text_content((row.xpath(f".//*[{class_xpath('category')}]") or [None])[0])
            athlete = text_content((row.xpath(f".//*[{class_xpath('athlete')}]") or [None])[0])
            if category and athlete:
                registrations.append({"academy": academy, "category": category, "athlete": athlete})
    if not registrations:
        raise UpdateError("No athlete registrations were parsed")
    return registrations


def division_parts(category: str) -> dict[str, str]:
    parts = [part.strip() for part in category.split("/")]
    if len(parts) != 4:
        raise UpdateError(f"Unrecognized division: {category}")
    belt, age, gender, weight_source = parts
    weight_class = re.sub(r"\s*\([^)]*\)\s*$", "", weight_source).strip()
    limit = re.search(r"\((\d+(?:\.\d+)?)lb\)", weight_source, flags=re.I)
    weight = weight_class
    if limit:
        number = float(limit.group(1))
        rendered = f"{number:.1f}".rstrip("0").rstrip(".")
        weight = f"{weight_class} · {rendered} lb"
    return {"belt": belt.title(), "age": age, "gender": gender.title(), "weight_class": weight_class, "weight": weight}


def division_key(age: str, gender: str, belt: str, weight_class: str) -> str:
    return "|".join(normalize(value) for value in (age, gender, belt, weight_class))


def minutes_from_time(label: str) -> int:
    parsed = datetime.strptime(label.strip(), "%I:%M %p")
    return parsed.hour * 60 + parsed.minute


def render_time(minutes: int) -> str:
    minutes %= 24 * 60
    stamp = datetime(2000, 1, 1) + timedelta(minutes=minutes)
    return stamp.strftime("%I:%M %p").lstrip("0")


def parse_schedule(payload: bytes, event: str) -> dict[str, dict[str, Any]]:
    tree = html.fromstring(payload)
    schedule: dict[str, dict[str, Any]] = {}
    for wrapper in tree.xpath(f"//*[{class_xpath('public-schedule__category-wrapper')}]"):
        anchors = wrapper.xpath("./a")
        if not anchors:
            continue
        anchor = anchors[0]
        category = " ".join((anchor.text or "").split())
        span = (anchor.xpath("./span") or [None])[0]
        time_label = text_content(span).replace("*", "").replace("**", "").strip()
        if not category or not time_label:
            continue
        category_parts = [part.strip() for part in category.split("/")]
        if len(category_parts) != 4:
            continue
        age, gender, belt, weight_class = category_parts
        panel = (wrapper.xpath(f"ancestor::*[{class_xpath('panel')}][1]") or [None])[0]
        day = text_content((panel.xpath(f".//*[{class_xpath('public-schedule__day')}]//span") or [None])[0]) if panel is not None else ""
        time_match = re.search(r"(\d{1,2}:\d{2}\s+[AP]M)", time_label, flags=re.I)
        day_match = re.search(r",\s*([^,]+)$", time_label)
        if not day and day_match:
            day = day_match.group(1).strip()
        if not time_match:
            continue
        href = anchor.get("href", "")
        if href.startswith("/"):
            href = f"https://www.bjjcompsystem.com{href}"
        schedule[division_key(age, gender, belt, weight_class)] = {
            "category": category,
            "url": href,
            "single": "single_competitors" in href,
            "date": EVENTS[event]["dates"].get(day),
            "time": render_time(minutes_from_time(time_match.group(1).upper())),
            "sortMinutes": minutes_from_time(time_match.group(1).upper()),
        }
    if not schedule:
        raise UpdateError(f"No schedule divisions were parsed for {event}")
    return schedule


def parse_bracket(payload: bytes, source_athlete: str) -> dict[str, Any] | None:
    tree = html.fromstring(payload)
    target = normalize(source_athlete)
    scheduled: list[dict[str, Any]] = []
    for match in tree.xpath(f"//*[{class_xpath('tournament-category__match')}]"):
        names = [text_content(node) for node in match.xpath(f".//*[{class_xpath('match-card__competitor-name')}]")]
        if target not in {normalize(name) for name in names}:
            continue
        where = text_content((match.xpath(f".//*[{class_xpath('bracket-match-header__where')}]") or [None])[0])
        when = text_content((match.xpath(f".//*[{class_xpath('bracket-match-header__when')}]") or [None])[0])
        if not where or not when:
            continue
        where_match = re.search(r"FIGHT\s+(\d+):\s*(Mat\s+\d+)", where, flags=re.I)
        when_match = re.search(r"(\d{2})/(\d{2}).*?(\d{1,2}:\d{2}\s+[AP]M)", when, flags=re.I)
        if not where_match or not when_match:
            continue
        opponents = [name for name in names if normalize(name) != target]
        if not opponents:
            opponents = [text_content(node).replace("Winner of ", "Winner: ") for node in match.xpath(f".//*[{class_xpath('match-card__child-where')}]") if text_content(node) != "-"]
        minutes = minutes_from_time(when_match.group(3).upper())
        scheduled.append({
            "date": f"2026-{when_match.group(1)}-{when_match.group(2)}",
            "time": render_time(minutes),
            "sortMinutes": minutes,
            "mat": where_match.group(2).title(),
            "bout": f"Fight {int(where_match.group(1))}",
            "opponent": opponents[0] if opponents else "Bracket opponent TBD",
        })
    return sorted(scheduled, key=lambda item: (item["date"], item["sortMinutes"]))[0] if scheduled else None


def parse_single(payload: bytes, source_athlete: str, event: str) -> dict[str, Any] | None:
    tree = html.fromstring(payload)
    target = normalize(source_athlete)
    for item in tree.xpath(f"//*[{class_xpath('public-single-competitors__item-wrapper')}]"):
        athlete = text_content((item.xpath(f".//*[{class_xpath('public-single-competitors__competitor-name')}]") or [None])[0])
        if normalize(athlete) != target:
            continue
        label = text_content((item.xpath(f".//*[{class_xpath('public-single-competitors__weighing-end')}]") or [None])[0]).replace("*", "")
        match = re.search(r"(\d{1,2}:\d{2}\s+[AP]M),\s*(.+)$", label, flags=re.I)
        if not match:
            return None
        minutes = minutes_from_time(match.group(1).upper())
        return {
            "date": EVENTS[event]["dates"].get(match.group(2).strip(), "2026-07-19"),
            "time": render_time(minutes),
            "sortMinutes": minutes,
            "mat": "Single Bracket Table",
            "bout": "Report by",
            "opponent": "Single-athlete division",
        }
    return None


def slug(value: str) -> str:
    value = normalize(value)
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as exc:
        raise UpdateError(f"Invalid JSON in {path}: {exc}") from exc


def validate(data: dict[str, Any], previous: dict[str, Any] | None = None, overrides: dict[str, Any] | None = None) -> None:
    required = {"schemaVersion", "updatedAt", "title", "timezone", "venue", "events", "days", "watchList", "entries"}
    missing = required - data.keys()
    if missing:
        raise UpdateError(f"Schedule JSON is missing: {', '.join(sorted(missing))}")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise UpdateError("entries must be a list")
    minimum = int((overrides or {}).get("minimumEntries", 1))
    if len(entries) < minimum:
        raise UpdateError(f"Only {len(entries)} entries were produced; expected at least {minimum}")
    ids: set[str] = set()
    keys: set[tuple[str, str]] = set()
    entry_required = {"id", "athlete", "event", "school", "belt", "age", "gender", "weight", "date", "time", "sortMinutes", "arrival", "mat", "bout", "opponent", "bracketUrl", "scheduleStatus"}
    for entry in entries:
        absent = entry_required - entry.keys()
        if absent:
            raise UpdateError(f"{entry.get('athlete', 'Entry')} is missing: {', '.join(sorted(absent))}")
        if entry["id"] in ids:
            raise UpdateError(f"Duplicate id: {entry['id']}")
        key = (entry["event"], normalize(entry["athlete"]))
        if key in keys:
            raise UpdateError(f"Duplicate registration: {entry['event']} / {entry['athlete']}")
        ids.add(entry["id"])
        keys.add(key)
        if entry["event"] not in {"Gi", "No-Gi"}:
            raise UpdateError(f"Invalid event: {entry['event']}")
        if not str(entry["bracketUrl"]).startswith("https://www.bjjcompsystem.com/"):
            raise UpdateError(f"Unexpected bracket URL for {entry['athlete']}")

    if previous and previous.get("entries"):
        old_count = len(previous["entries"])
        max_drop = float((overrides or {}).get("maximumDropFraction", 0.35))
        if len(entries) < old_count * (1 - max_drop):
            raise UpdateError(f"Entry count dropped from {old_count} to {len(entries)}; keeping previous data")
        old = {(item["event"], normalize(item["athlete"])): item for item in previous["entries"]}
        for entry in entries:
            prior = old.get((entry["event"], normalize(entry["athlete"])))
            if prior and prior.get("scheduleStatus") in {"scheduled", "single"} and entry.get("scheduleStatus") == "pending":
                raise UpdateError(f"Schedule regressed to pending for {entry['athlete']}; keeping previous data")


def select_registrations(all_registrations: dict[str, list[dict[str, str]]], overrides: dict[str, Any]) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    academies = {normalize(value) for value in overrides["academyAliases"]}
    specials = overrides.get("specialAthletes", [])
    alias_map: dict[str, dict[str, Any]] = {}
    for special in specials:
        for alias in special["aliases"]:
            alias_map[normalize(alias)] = special

    selected: list[dict[str, str]] = []
    found_specials: set[str] = set()
    for event, registrations in all_registrations.items():
        for registration in registrations:
            special = alias_map.get(normalize(registration["athlete"]))
            is_capital_academy = normalize(registration["academy"]) in academies
            if special:
                found_specials.add(special["canonicalName"])
            if not is_capital_academy and not (special and special.get("alwaysIncludeWhenFound")):
                continue
            chosen = dict(registration)
            chosen["event"] = event
            chosen["sourceAthlete"] = registration["athlete"]
            if special:
                chosen["athlete"] = special["canonicalName"]
                if special.get("capitalNote"):
                    chosen["capitalNote"] = special["capitalNote"]
            selected.append(chosen)

    watch_list: list[dict[str, Any]] = []
    for special in specials:
        if not special.get("watchOnlyWhenMissing"):
            continue
        found = special["canonicalName"] in found_specials
        watch_list.append({
            "canonicalName": special["canonicalName"],
            "aliases": special["aliases"],
            "found": found,
            "message": (
                f"{special['canonicalName']} is registered and included in the roster."
                if found
                else f"No {' or '.join(special['aliases'])} appears in either the Gi or No-Gi athlete list."
            ),
        })
    return selected, watch_list


def build_data(previous: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    registrations_by_event: dict[str, list[dict[str, str]]] = {}
    schedules: dict[str, dict[str, dict[str, Any]]] = {}
    for event, config in EVENTS.items():
        registrations_by_event[event] = parse_registrations(fetch(config["athletes_url"]))
        schedules[event] = parse_schedule(fetch(config["schedule_url"]), event)

    selected, watch_list = select_registrations(registrations_by_event, overrides)
    previous_ids = {(item["event"], normalize(item["athlete"])): item["id"] for item in previous.get("entries", [])}
    bracket_cache: dict[str, bytes] = {}
    single_cache: dict[str, bytes] = {}
    entries: list[dict[str, Any]] = []

    for registration in selected:
        event = registration["event"]
        parts = division_parts(registration["category"])
        key = division_key(parts["age"], parts["gender"], parts["belt"], parts["weight_class"])
        schedule = schedules[event].get(key)
        if not schedule:
            raise UpdateError(f"No schedule division found for {registration['athlete']}: {registration['category']}")

        details: dict[str, Any] | None
        if schedule["single"]:
            url = EVENTS[event]["single_url"]
            single_cache.setdefault(url, fetch(url))
            details = parse_single(single_cache[url], registration["sourceAthlete"], event)
        else:
            url = schedule["url"]
            bracket_cache.setdefault(url, fetch(url))
            details = parse_bracket(bracket_cache[url], registration["sourceAthlete"])

        if details:
            status = "single" if schedule["single"] else "scheduled"
        else:
            details = {
                "date": schedule.get("date") or "2026-07-19",
                "time": schedule["time"],
                "sortMinutes": schedule["sortMinutes"],
                "mat": "Mat TBD",
                "bout": "Division start",
                "opponent": "Bracket pending",
            }
            status = "pending"

        athlete = registration["athlete"]
        id_key = (event, normalize(athlete))
        entry_id = previous_ids.get(id_key) or f"{'gi' if event == 'Gi' else 'nogi'}-{slug(athlete)}"
        entry: dict[str, Any] = {
            "id": entry_id,
            "athlete": athlete,
            "event": event,
            "school": registration["academy"],
            "belt": parts["belt"],
            "age": parts["age"],
            "gender": parts["gender"],
            "weight": parts["weight"],
            "date": details["date"],
            "time": details["time"],
            "sortMinutes": details["sortMinutes"],
            "arrival": render_time(details["sortMinutes"] - 60),
            "mat": details["mat"],
            "bout": details["bout"],
            "opponent": details["opponent"],
            "bracketUrl": schedule["url"],
            "scheduleStatus": status,
        }
        if schedule["single"]:
            entry["single"] = True
        if registration.get("capitalNote"):
            entry["capitalNote"] = registration["capitalNote"]
        entries.append(entry)

    entries.sort(key=lambda item: (item["date"], item["sortMinutes"], item["athlete"]))
    result = copy.deepcopy(previous) if previous else {}
    result.update({
        "schemaVersion": 1,
        "title": "Capital Mat Calls · Virginia Open 2026",
        "timezone": "America/New_York",
        "venue": {"name": "Fredericksburg Convention Center — Hall A + B", "address": "2371 Carl D Silver Pkwy, Fredericksburg, VA 22401"},
        "events": {
            "Gi": {"eventId": 3231, "url": "https://ibjjf.com/events/virginia-international-open-ibjjf-jiu-jitsu-championship-2026", "scheduleUrl": EVENTS["Gi"]["schedule_url"]},
            "No-Gi": {"eventId": 3232, "url": "https://ibjjf.com/events/virginia-international-open-ibjjf-jiu-jitsu-no-gi-championship-2026", "scheduleUrl": EVENTS["No-Gi"]["schedule_url"]},
        },
        "days": [
            {"date": "2026-07-18", "eyebrow": "Saturday · Gi", "label": "July 18"},
            {"date": "2026-07-19", "eyebrow": "Sunday · Gi + No-Gi", "label": "July 19"},
        ],
        "watchList": watch_list,
        "entries": entries,
    })
    return result


def substantive(data: dict[str, Any]) -> dict[str, Any]:
    clone = copy.deepcopy(data)
    clone.pop("updatedAt", None)
    return clone


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        overrides = load_json(args.overrides)
        previous = load_json(args.output)
        if args.validate_only:
            validate(previous, overrides=overrides)
            print(f"Valid schedule data: {len(previous['entries'])} entries")
            return 0

        updated = build_data(previous, overrides)
        validate(updated, previous=previous, overrides=overrides)
        if previous and substantive(updated) == substantive(previous):
            print(f"No schedule changes ({len(updated['entries'])} entries)")
            return 0

        updated["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        old_entries = {(item["event"], item["athlete"]): item for item in previous.get("entries", [])}
        new_entries = {(item["event"], item["athlete"]): item for item in updated["entries"]}
        added = sorted(set(new_entries) - set(old_entries))
        removed = sorted(set(old_entries) - set(new_entries))
        changed = sorted(key for key in set(old_entries) & set(new_entries) if old_entries[key] != new_entries[key])
        print(f"Schedule changed: +{len(added)} / -{len(removed)} / ~{len(changed)}")
        for label, values in (("Added", added), ("Removed", removed), ("Changed", changed)):
            for event, athlete in values:
                print(f"  {label}: {event} · {athlete}")
        if args.dry_run:
            return 0

        args.output.parent.mkdir(parents=True, exist_ok=True)
        rendered = json.dumps(updated, indent=2, ensure_ascii=False) + "\n"
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=args.output.parent, delete=False) as handle:
            handle.write(rendered)
            temporary = Path(handle.name)
        temporary.replace(args.output)
        print(f"Updated {args.output}")
        return 0
    except UpdateError as exc:
        print(f"Update refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
