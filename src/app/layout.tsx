import type { Metadata, Viewport } from "next";
import { AppNavigation } from "@/components/ui/app-navigation";
import "./globals.css";

export const metadata: Metadata = { title: "Kaushal AI", description: "Evidence-based competency assessment" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body data-design-contract="kaushal-frame-adaptation-v1"><a className="skip-link" href="#main-content">Skip to main content</a><div className="site-frame"><AppNavigation/><div className="content-frame">{children}</div></div></body></html>;
}
