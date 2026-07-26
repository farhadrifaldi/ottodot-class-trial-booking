import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Ottodot Trial Booking",
  description: "Book a trial class",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-16">
          <TopNav />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
