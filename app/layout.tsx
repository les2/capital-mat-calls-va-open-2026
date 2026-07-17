import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const protocol = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title: "Capital Mat Calls · Virginia Open 2026",
    description: "The Capital MMA and Capital Jiu-Jitsu athlete schedule for the 2026 IBJJF Virginia Open, with first-bout times, mats, brackets, and calendar downloads.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Capital Mat Calls", description: "Virginia Open athlete schedule · July 18–19, 2026", type: "website", images: [{ url: image, width: 1731, height: 909, alt: "Capital Mat Calls — Virginia Open July 18–19, 2026" }] },
    twitter: { card: "summary_large_image", title: "Capital Mat Calls", description: "Virginia Open athlete schedule · July 18–19, 2026", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
