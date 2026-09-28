import type { Metadata } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AppToaster } from "@/components/AppToaster";
import { ThemeProvider } from "@/components/ThemeProvider";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: {
    default: "BuzzerBidder",
    template: "%s · BuzzerBidder",
  },
  description:
    "Queue ShopGoodwill auctions, compare eBay comps, and place last-second bids.",
  metadataBase: new URL("https://buzzerbidder.com"),
  openGraph: {
    title: "BuzzerBidder",
    description:
      "Queue ShopGoodwill auctions, compare eBay comps, and place last-second bids.",
    url: "https://buzzerbidder.com",
    siteName: "BuzzerBidder",
    type: "website",
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
