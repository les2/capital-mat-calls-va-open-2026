const SOURCE_URL =
  "https://raw.githubusercontent.com/les2/capital-mat-calls-va-open-2026/main/public/data/schedule.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return Response.json({ error: "Schedule source unavailable" }, { status: 502 });
    }

    const body = await response.text();
    const data = JSON.parse(body) as { schemaVersion?: number; entries?: unknown[] };
    if (data.schemaVersion !== 1 || !Array.isArray(data.entries)) {
      return Response.json({ error: "Schedule source is invalid" }, { status: 502 });
    }

    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return Response.json({ error: "Schedule source unavailable" }, { status: 502 });
  }
}
