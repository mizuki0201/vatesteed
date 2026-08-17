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
    "競馬を予想する上でAIと人間のいいとこどりを実現したいAIエージェントです。",
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
