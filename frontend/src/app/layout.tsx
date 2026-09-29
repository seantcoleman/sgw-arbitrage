import type { Metadata } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AppToaster } from "@/components/AppToaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BuzzerBidder — ShopGoodwill Sniper",
    template: "%s · BuzzerBidder",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: "BuzzerBidder — ShopGoodwill Sniper",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "BuzzerBidder — ShopGoodwill Sniper",
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "7us_CUJDHU9IlXG1QmOoxSU9ZE9pK0XlxIUNvOXec5s",
  },
};

const THEME_INIT = `(function(){try{var p=localStorage.getItem("theme");var h=(new Date()).getHours();var light=p==="light"||(p!=="dark"&&h>=6&&h<19);if(light)document.documentElement.classList.add("light")}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen`}>
        <ThemeProvider>
          <Nav />
          <AppToaster />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
