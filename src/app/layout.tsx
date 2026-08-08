import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HudFrame from "@/components/HudFrame";
import SmoothScroll from "@/components/SmoothScroll";
import ScrollProgress from "@/components/ScrollProgress";
import MotionProvider from "@/components/MotionProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CodeChef PESUECC Chapter",
    template: "%s · CodeChef PESUECC Chapter",
  },
  description:
    "The official portal and competitive programming ecosystem of the CodeChef PESUECC Chapter — a daily arena, technical initiatives, and the team building it in the open.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/*
         * Apply the persisted theme before first paint so there is no flash of
         * the wrong mode on load. Runs synchronously during HTML parsing and
         * sets `.dark` on <html>; the Navbar toggle keeps it in sync afterwards.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <MotionProvider>
          <SmoothScroll />
          <ScrollProgress />
          <Navbar />
          <HudFrame />
          <div className="flex flex-1 flex-col pt-24">{children}</div>
          <Footer />
        </MotionProvider>
      </body>
    </html>
  );
}
