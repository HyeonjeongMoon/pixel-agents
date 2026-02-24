import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Dashboard Mock",
  description: "OpenAPI + Event Schema 기반 에이전트 대시보드 데모",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
