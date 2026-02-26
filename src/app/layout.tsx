import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Проект-Коины — Геймификация",
  description: "Корпоративная система геймификации",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-[260px] p-8 max-w-[1200px]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
