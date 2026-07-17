"use client";

import { useMemo, useState } from "react";

type Entry = {
  id: string;
  athlete: string;
  event: "Gi" | "No-Gi";
  school: string;
  belt: string;
  age: string;
  gender: string;
  weight: string;
  date: "2026-07-18" | "2026-07-19";
  time: string;
  sortMinutes: number;
  arrival: string;
  mat: string;
  bout: string;
  opponent: string;
  bracketUrl: string;
  single?: boolean;
};

const VENUE = "Fredericksburg Convention Center — Hall A + B";
const ADDRESS = "2371 Carl D Silver Pkwy, Fredericksburg, VA 22401";
const GI_EVENT = "https://ibjjf.com/events/virginia-international-open-ibjjf-jiu-jitsu-championship-2026";
const NOGI_EVENT = "https://ibjjf.com/events/virginia-international-open-ibjjf-jiu-jitsu-no-gi-championship-2026";

const entries: Entry[] = [
  { id: "gi-rex", athlete: "Rex Jinha Kim", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Blue", age: "Master 2", gender: "Male", weight: "Light · 168 lb", date: "2026-07-18", time: "1:21 PM", sortMinutes: 801, arrival: "12:21 PM", mat: "Mat 4", bout: "Fight 30", opponent: "Battelmen Batchuluun", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887048" },
  { id: "gi-jessica", athlete: "Jessica Elaine Simon", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Blue", age: "Master 2", gender: "Female", weight: "Medium Heavy · 163.6 lb", date: "2026-07-18", time: "2:20 PM", sortMinutes: 860, arrival: "1:20 PM", mat: "Mat 6", bout: "Fight 40", opponent: "Alyssa Nicole Barcenas", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887103" },
  { id: "gi-diana", athlete: "Diana Bowen", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Blue", age: "Master 2", gender: "Female", weight: "Heavy · 175 lb", date: "2026-07-18", time: "2:47 PM", sortMinutes: 887, arrival: "1:47 PM", mat: "Mat 2", bout: "Fight 43", opponent: "Jacqueline Nicole Knox", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887108" },
  { id: "gi-bardia", athlete: "Bardia Golkar", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Purple", age: "Master 2", gender: "Male", weight: "Super Heavy · 222 lb", date: "2026-07-18", time: "2:55 PM", sortMinutes: 895, arrival: "1:55 PM", mat: "Mat 6", bout: "Fight 45", opponent: "Ryan Patrick Kelly", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887069" },
  { id: "gi-christian", athlete: "Christian Marlon Platon", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Purple", age: "Master 2", gender: "Male", weight: "Medium Heavy · 195 lb", date: "2026-07-18", time: "3:46 PM", sortMinutes: 946, arrival: "2:46 PM", mat: "Mat 5", bout: "Fight 50", opponent: "Robert Vincent Barcos", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887059" },
  { id: "gi-lloyd", athlete: "Lloyd E Smith II", event: "Gi", school: "Capital Jiu-Jitsu", belt: "Purple", age: "Master 3", gender: "Male", weight: "Light · 168 lb", date: "2026-07-18", time: "3:52 PM", sortMinutes: 952, arrival: "2:52 PM", mat: "Mat 1", bout: "Fight 45", opponent: "Paulo Gujef Junior", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2887134" },
  { id: "gi-paul", athlete: "Paul Constantin Raduca", event: "Gi", school: "Capital Jiu-Jitsu", belt: "White", age: "Adult", gender: "Male", weight: "Light · 168 lb", date: "2026-07-19", time: "12:22 PM", sortMinutes: 742, arrival: "11:22 AM", mat: "Mat 2", bout: "Fight 2", opponent: "Elliot Allan Simpson", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3231/categories/2886877" },
  { id: "nogi-chad", athlete: "Chad Andre Malone", event: "No-Gi", school: "Chapel Hill Team Roc", belt: "Black", age: "Master 3", gender: "Male", weight: "Super Heavy · 215 lb", date: "2026-07-19", time: "1:52 PM", sortMinutes: 832, arrival: "12:52 PM", mat: "Mat 8", bout: "Fight 2", opponent: "Brad Alan Pearson", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3232/categories/2887866" },
  { id: "nogi-bion", athlete: "Bion Kim", event: "No-Gi", school: "Capital MMA", belt: "Purple", age: "Master 5", gender: "Male", weight: "Light Feather · 136 lb", date: "2026-07-19", time: "3:32 PM", sortMinutes: 932, arrival: "2:32 PM", mat: "Single Bracket Table", bout: "Report by", opponent: "Single-athlete division", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3232/single_competitors", single: true },
  { id: "nogi-diana", athlete: "Diana Bowen", event: "No-Gi", school: "Capital Jiu-Jitsu", belt: "Blue", age: "Master 2", gender: "Female", weight: "Heavy · 169 lb", date: "2026-07-19", time: "4:13 PM", sortMinutes: 973, arrival: "3:13 PM", mat: "Mat 1", bout: "Fight 15", opponent: "Jacqueline Nicole Knox", bracketUrl: "https://www.bjjcompsystem.com/tournaments/3232/categories/2887827" },
];

const days = [
  { date: "2026-07-18", eyebrow: "Saturday · Gi", label: "July 18" },
  { date: "2026-07-19", eyebrow: "Sunday · Gi + No-Gi", label: "July 19" },
] as const;

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

function eventToIcs(entry: Entry) {
  const source = entry.event === "Gi" ? GI_EVENT : NOGI_EVENT;
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
    `LOCATION:${icsEscape(`${VENUE}, ${ADDRESS}`)}`,
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

function makeIcs(items: Entry[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Capital Mat Calls//Virginia Open 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Capital · Virginia Open 2026",
    "X-WR-TIMEZONE:America/New_York",
    ...items.map(eventToIcs),
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadCalendar(items: Entry[], name: string) {
  const blob = new Blob([makeIcs(items)], { type: "text/calendar;charset=utf-8" });
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
  const visible = useMemo(
    () => entries.filter((entry) => filter === "All" || entry.event === filter),
    [filter],
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
          <button className="download-button compact" onClick={() => downloadCalendar(entries, "capital-virginia-open-2026.ics")}>
            Download .ics <span aria-hidden="true">↓</span>
          </button>
        </nav>

        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="kicker"><span /> Virginia Open · July 18–19, 2026</p>
            <h1>Every Capital<br /><em>mat call.</em></h1>
            <p className="hero-deck">One clean schedule for Capital MMA and Capital Jiu-Jitsu competitors across the Gi and No-Gi weekends.</p>
            <div className="hero-actions">
              <button className="download-button" onClick={() => downloadCalendar(entries, "capital-virginia-open-2026.ics")}>Add all to calendar <span aria-hidden="true">↘</span></button>
              <a className="text-link" href="#schedule">View the timeline <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <aside className="hero-card" aria-label="Event at a glance">
            <p className="card-label">Event at a glance</p>
            <div className="big-number">9</div>
            <p className="big-number-label">unique Capital athletes</p>
            <dl>
              <div><dt>Entries</dt><dd>10</dd></div>
              <div><dt>Days</dt><dd>2</dd></div>
              <div><dt>First call</dt><dd>Sat · 1:21 PM</dd></div>
            </dl>
            <div className="venue-line"><span aria-hidden="true">⌖</span><p>{VENUE}<small>Fredericksburg, Virginia</small></p></div>
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
                          <button onClick={() => downloadCalendar([entry], `${entry.id}-virginia-open-2026.ics`)}>Add to calendar</button>
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
          <p className="verified">Verified against IBJJF athlete lists and live brackets · Jul 17, 2026</p>
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
                  <td>{entry.school}{entry.athlete.startsWith("Chad") && <small className="capital-note">Capital athlete · alternate black-belt school</small>}</td>
                  <td>{entry.date === "2026-07-18" ? "Sat" : "Sun"} · {entry.time}<small>{entry.mat}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="nick-note">
          <div className="search-icon" aria-hidden="true">N?</div>
          <div><strong>Nicholas “Nick” Jay</strong><p>No Nick or Nicholas Jay appears in either the Gi or No-Gi athlete list as of July 17, 2026.</p></div>
        </div>
      </section>

      <footer>
        <div><span className="brand-mark">C</span><strong>Capital Mat Calls</strong></div>
        <p>Unofficial team companion. Estimated times can change—follow the official bullpen screens.</p>
        <div className="source-links"><a href={GI_EVENT} target="_blank" rel="noreferrer">Gi event ↗</a><a href={NOGI_EVENT} target="_blank" rel="noreferrer">No-Gi event ↗</a></div>
      </footer>
    </main>
  );
}
