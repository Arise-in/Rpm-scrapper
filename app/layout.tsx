import "./globals.css";
import React from "react";

export const metadata = {
  title: "RPM Media Cockpit",
  description: "Inspect RPM scraper JSON, stream endpoints, subtitles, audio tracks, and storyboard previews.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
