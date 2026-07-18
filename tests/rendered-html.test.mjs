import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("schedule data is complete and safe to publish", async () => {
  const data = JSON.parse(await readFile(new URL("public/data/schedule.json", root), "utf8"));

  assert.equal(data.schemaVersion, 1);
  assert.equal(data.timezone, "America/New_York");
  assert.ok(data.entries.length >= 5);
  assert.equal(new Set(data.entries.map((entry) => entry.id)).size, data.entries.length);
  assert.ok(data.entries.every((entry) => /^https:\/\/www\.bjjcompsystem\.com\//.test(entry.bracketUrl)));
  assert.ok(data.entries.every((entry) => ["scheduled", "single", "pending"].includes(entry.scheduleStatus)));

  const chad = data.entries.find((entry) => entry.athlete === "Chad Andre Malone");
  assert.equal(chad?.capitalNote, "Capital athlete · alternate black-belt school");

  const nick = data.watchList.find((item) => item.canonicalName === "Nicholas Jay");
  assert.equal(typeof nick?.found, "boolean");
});

test("site loads the same-origin schedule and generates calendars from it", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/schedule/route.ts", root), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/schedule", \{ cache: "no-store" \}\)/);
  assert.match(page, /text\/calendar;charset=utf-8/);
  assert.match(page, /X-WR-TIMEZONE:\$\{data\.timezone\}/);
  assert.match(page, /data\.watchList\.find/);
  assert.doesNotMatch(page, /const entries: Entry\[\] = \[/);
  assert.match(route, /raw\.githubusercontent\.com\/les2\/capital-mat-calls-va-open-2026\/main/);
  assert.match(route, /"Cache-Control": "no-store, max-age=0"/);
});
