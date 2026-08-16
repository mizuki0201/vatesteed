import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/screens/site-header";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vatesteed",
  description:
    "膨大なデータを集めて解析する AI と、データに表れない文脈を読む人間。ふたりで競馬の予想を組み立てるエージェントです。",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(sans.variable, mono.variable)} lang="ja">
      <body>
        {/*
          ナビは閲覧レベルでリンクを出し分けるが、**それは表示の都合**。
          守りはデータを取る側（lib/access の assertCan）にある。
          レイアウトは画面遷移で再実行されないので、ここに認可の判定を置かない。
        */}
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
