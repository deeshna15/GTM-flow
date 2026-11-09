import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "GTMFlow – AI-Powered Lead Intelligence & GTM Automation",
  description:
    "Portfolio-quality GTM engineering platform for lead intelligence, account scoring, deduplication, and sales automation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-slate-50 text-slate-900">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
