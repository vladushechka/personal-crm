import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ContactRoundIcon } from "lucide-react";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Личная CRM",
  description: "Контакты людей, которых я знаю лично, и заметки о разговорах с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-neutral-50">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-12 w-full max-w-3xl items-center px-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
              <ContactRoundIcon className="size-4" aria-hidden />
              Личная CRM
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
