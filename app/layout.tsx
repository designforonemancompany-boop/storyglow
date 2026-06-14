import type { Metadata } from "next";
import "./globals.css";
import { FeedbackFab } from "@/components/feedback-fab";

export const metadata: Metadata = {
  title: "StoryGlow | Bedtime stories made from your memories",
  description: "Create a private personalized bedtime story to read, hear, and share.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<FeedbackFab /></body>
    </html>
  );
}
