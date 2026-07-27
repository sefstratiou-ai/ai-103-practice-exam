import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "AI-103 Practice Exam | Azure AI Apps and Agents",
    description:
      "A full-length, unofficial AI-103 practice exam simulator aligned to Microsoft's April 2026 skills outline.",
    openGraph: {
      title: "AI-103 Practice Exam",
      description: "95 original questions · 50 per attempt · 5 skill domains",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "AI-103 Practice Exam" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AI-103 Practice Exam",
      description: "Blueprint-aligned practice for Developing AI Apps and Agents on Azure",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
