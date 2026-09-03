import type { Metadata, Viewport } from "next";
import { Geologica, Manrope } from "next/font/google";
import "./globals.css";

const display = Geologica({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["600", "700", "800", "900"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "greek"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "ΣΤΟΝ ΚΟΥΒΑ!",
    template: "%s · ΣΤΟΝ ΚΟΥΒΑ!",
  },
  description:
    "Βλέπεις τον αγώνα. Μπες στη συζήτηση. Live matches, chat, predictions — όχι bookmaker.",
  applicationName: "ΣΤΟΝ ΚΟΥΒΑ!",
  icons: {
    icon: "/brand/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
