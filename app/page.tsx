"use client";

import { useEffect, useMemo, useState } from "react";
import initialSchedule from "../public/data/schedule.json";

type Entry = {
  id: string;
  athlete: string;
  event: "Gi" | "No-Gi";
  school: string;
  belt: string;
  age: string;
  gender: string;
  weight: string;
  date: string;
  time: string;
  sortMinutes: number;
  arrival: string;
  mat: string;
  bout: string;
  opponent: string;
  bracketUrl: string;
  scheduleStatus: "scheduled" | "single" | "pending";
  capitalNote?: string;
  single?: boolean;
};

type ScheduleData = {
  schemaVersion: number;
  updatedAt: string;
  title: string;
  timezone: string;
  venue: { name: string; address: string };
  events: Record<"Gi" | "No-Gi", { eventId: number; url: string; scheduleUrl: string }>;
  days: { date: string; eyebrow: string; label: string }[];
  watchList: { canonicalName: string; aliases: string[]; found: boolean; message: string }[];
  entries: Entry[];
};

const fallbackSchedule = initialSchedule as ScheduleData;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localStamp(entry: Entry, addMinutes = 0) {
  const [year, month, day] = entry.date.split("-").map(Number);
  const total = entry.sortMinutes + addMinutes;
  return `${year}${pad(month)}${pad(day)}T${pad(Math.floor(total / 60))}${pad(total % 60)}00`;
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function eventToIcs(entry: Entry, data: ScheduleData) {
  const source = data.events[entry.event].url;
  const summary = entry.single ? `${entry.athlete} · Single bracket check-in` : `${entry.athlete} · ${entry.event} first bout`;
  const description = [
    `${entry.belt} / ${entry.age} / ${entry.gender} / ${entry.weight}`,
    entry.single ? `Report to the ${entry.mat} by ${entry.time}.` : `${entry.bout} on ${entry.mat} vs. ${entry.opponent}.`,
    `Registered school: ${entry.school}`,
    `IBJJF advises athletes to be in the bullpen one hour early — ${entry.arrival}.`,
    `Bracket: ${entry.bracketUrl}`,
    `Event: ${source}`,
  ].join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:${entry.id}-2026-va-open@capitalmatcalls`,
    "DTSTAMP:20260717T160000Z",
    `DTSTART;TZID=America/New_York:${localStamp(entry)}`,
    `DTEND;TZID=America/New_York:${localStamp(entry, entry.single ? 15 : 30)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(`${data.venue.name}, ${data.venue.address}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${entry.bracketUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Bullpen reminder for ${entry.athlete}`)}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

function makeIcs(items: Entry[], data: ScheduleData) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Capital Mat Calls//Virginia Open 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Capital · Virginia Open 2026",
    `X-WR-TIMEZONE:${data.timezone}`,
    ...items.map((entry) => eventToIcs(entry, data)),
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadCalendar(items: Entry[], name: string, data: ScheduleData) {
  const blob = new Blob([makeIcs(items, data)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [filter, setFilter] = useState<"All" | "Gi" | "No-Gi">("All");
  const [data, setData] = useState<ScheduleData>(fallbackSchedule);
  useEffect(() => {
    fetch("/api/schedule", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Schedule request failed: ${response.status}`);
        return response.json() as Promise<ScheduleData>;
      })
      .then(setData)
      .catch(() => undefined);
  }, []);
  const entries = data.entries;
  const days = data.days;
  const uniqueAthletes = new Set(entries.map((entry) => entry.athlete)).size;
  const firstEntry = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.sortMinutes - b.sortMinutes)[0];
  const updatedLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: data.timezone }).format(new Date(data.updatedAt));
  const nick = data.watchList.find((item) => item.canonicalName === "Nicholas Jay");
  const visible = useMemo(
    () => entries.filter((entry) => filter === "All" || entry.event === filter),
    [entries, filter],
  );

  return (
    <main>
      <section className="hero">
        <nav className="topbar" aria-label="Page navigation">
          <a className="brand" href="#top" aria-label="Capital Mat Calls home">
            <span className="brand-mark">C</span>
            <span>Capital Mat Calls</span>
          </a>
          <div className="nav-links">
            <a href="#schedule">Schedule</a>
            <a href="#roster">Roster</a>
          </div>
          <button className="download-button compact" onClick={() => downloadCalendar(entries, "capital-virginia-open-2026.ics", data)}>
            Download .ics <span aria-hidden="true">↓</span>
          </button>
        </nav>

        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="kicker"><span /> Virginia Open · July 18–19, 2026</p>
            <h1>Every Capital<br /><em>mat call.</em></h1>
            <p className="hero-deck">One clean schedule for Capital MMA and Capital Jiu-Jitsu competitors across the Gi and No-Gi weekends.</p>
            <div className="hero-actions">
              <button className="download-button" onClick={() => downloadCalendar(entries, "capital-virginia-open-2026.ics", data)}>Add all to calendar <span aria-hidden="true">↘</span></button>
              <a className="text-link" href="#schedule">View the timeline <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <aside className="hero-card" aria-label="Event at a glance">
            <p className="card-label">Event at a glance</p>
            <div className="big-number">{uniqueAthletes}</div>
            <p className="big-number-label">unique Capital athletes</p>
            <dl>
              <div><dt>Entries</dt><dd>{entries.length}</dd></div>
              <div><dt>Days</dt><dd>{days.length}</dd></div>
              <div><dt>First call</dt><dd>{firstEntry ? `${firstEntry.date === "2026-07-18" ? "Sat" : "Sun"} · ${firstEntry.time}` : "Pending"}</dd></div>
            </dl>
            <div className="venue-line"><span aria-hidden="true">⌖</span><p>{data.venue.name}<small>Fredericksburg, Virginia</small></p></div>
          </aside>
        </div>
      </section>

      <section className="notice-strip" aria-label="Important arrival reminder">
        <span>Arrive early</span>
        <p>IBJJF requires athletes in the bullpen at least <strong>one hour before</strong> the estimated division start. Live bullpen screens remain authoritative.</p>
      </section>

      <section className="schedule-section" id="schedule">
        <div className="section-heading">
          <div>
            <p className="section-number">01 · Team timeline</p>
            <h2>Weekend schedule</h2>
          </div>
          <div className="filters" aria-label="Filter schedule">
            {(["All", "Gi", "No-Gi"] as const).map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>
            ))}
          </div>
        </div>

        <div className="days-grid">
          {days.map((day) => {
            const dayEntries = visible.filter((entry) => entry.date === day.date).sort((a, b) => a.sortMinutes - b.sortMinutes);
            if (!dayEntries.length) return null;
            return (
              <article className="day-column" key={day.date}>
                <header className="day-header"><p>{day.eyebrow}</p><strong>{day.label}</strong></header>
                <div className="timeline">
                  {dayEntries.map((entry) => (
                    <div className={`timeline-entry ${entry.event === "No-Gi" ? "nogi" : "gi"}`} key={entry.id}>
                      <div className="time-rail"><time>{entry.time}</time><span /></div>
                      <div className="athlete-card">
                        <div className="athlete-topline"><span className={`event-pill ${entry.event === "No-Gi" ? "nogi-pill" : ""}`}>{entry.event}</span><span>{entry.belt} · {entry.age}</span></div>
                        <h3>{entry.athlete}</h3>
                        <p className="division">{entry.gender} · {entry.weight}</p>
                        <div className="bout-grid">
                          <div><small>{entry.single ? "Deadline" : "First bout"}</small><strong>{entry.bout} · {entry.mat}</strong></div>
                          <div><small>{entry.single ? "Status" : "Opponent"}</small><strong>{entry.opponent}</strong></div>
                          <div className="arrival"><small>Be in bullpen by</small><strong>{entry.arrival}</strong></div>
                        </div>
                        <div className="card-actions">
                          <a href={entry.bracketUrl} target="_blank" rel="noreferrer">{entry.single ? "Single bracket list" : "Open bracket"} ↗</a>
                          <button onClick={() => downloadCalendar([entry], `${entry.id}-virginia-open-2026.ics`, data)}>Add to calendar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="roster-section" id="roster">
        <div className="section-heading light">
          <div><p className="section-number">02 · Registration check</p><h2>Capital roster</h2></div>
          <p className="verified">Verified against IBJJF athlete lists and live brackets · {updatedLabel}</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Athlete</th><th>Event</th><th>Division</th><th>Registered school</th><th>First call</th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`row-${entry.id}`}>
                  <td><strong>{entry.athlete}</strong></td>
                  <td><span className={`event-pill ${entry.event === "No-Gi" ? "nogi-pill" : ""}`}>{entry.event}</span></td>
                  <td>{entry.belt} · {entry.age} · {entry.gender}<small>{entry.weight}</small></td>
                  <td>{entry.school}{entry.capitalNote && <small className="capital-note">{entry.capitalNote}</small>}</td>
                  <td>{entry.date === "2026-07-18" ? "Sat" : "Sun"} · {entry.time}<small>{entry.mat}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="nick-note">
          <div className="search-icon" aria-hidden="true">N?</div>
          <div><strong>Nicholas “Nick” Jay</strong><p>{nick?.message ?? "Nicholas Jay watch is active."} Checked {updatedLabel}.</p></div>
        </div>
      </section>

      <footer>
        <div><span className="brand-mark">C</span><strong>Capital Mat Calls</strong></div>
        <p>Unofficial team companion. Estimated times can change—follow the official bullpen screens.</p>
        <div className="source-links"><a href={data.events.Gi.url} target="_blank" rel="noreferrer">Gi event ↗</a><a href={data.events["No-Gi"].url} target="_blank" rel="noreferrer">No-Gi event ↗</a></div>
      </footer>
    </main>
  );
}
