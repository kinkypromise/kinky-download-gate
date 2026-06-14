import type { Metadata } from "next";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSettings();
    return {
      title: `${settings.artistName} — Free Download`,
      description: `Unlock free ${settings.artistName} tracks via SoundCloud.`,
    };
  } catch {
    return {
      title: "Artist Gate — Free Download",
      description: "Unlock free tracks via SoundCloud.",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
