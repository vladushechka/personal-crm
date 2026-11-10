import type { Metadata } from "next";
import { Golos_Text, Playfair_Display } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";

import { UserMenu } from "@/components/user-menu";

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
  title: "Personal CRM",
  description: "Контакты людей, которых я знаю лично, и заметки о разговорах с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto w-full max-w-3xl px-6 pt-5">
          <div className="flex items-center justify-between gap-3 border-b pb-5">
            <Link
              href="/"
              className="shrink-0 whitespace-nowrap rounded-sm font-heading text-xl font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-2xl"
            >
              Personal CRM
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              {/* The signed-in user: read on every request */}
              <Suspense>
                <UserMenu />
              </Suspense>
              {/* Notepad icon from the landing header; on narrow screens the email and «Выйти»
                  need its room */}
              <svg
                className="hidden size-6 shrink-0 sm:block"
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
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
