import type { Metadata } from "next";
import { Golos_Text, Playfair_Display } from "next/font/google";
import Link from "next/link";

import "./globals.css";

// Same fonts as the landing page: Golos Text for text, Playfair Display for headings
const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично, и заметки о разговорах с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto w-full max-w-3xl px-6 pt-5">
          <div className="flex items-center justify-between border-b pb-5">
            <Link
              href="/"
              className="rounded-sm font-heading text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-2xl"
            >
              Личная CRM
            </Link>
            {/* Notepad icon from the landing header */}
            <svg
              className="size-5.5 sm:size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 4h11l3 3v13H5z" />
              <path d="M9 10h6M9 14h6" />
            </svg>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
