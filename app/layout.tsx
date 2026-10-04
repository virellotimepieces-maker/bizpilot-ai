import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { HOME_METADATA } from "@/lib/marketing/copy";
import { requestPublicOrigin } from "@/lib/marketing/request-origin";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await requestPublicOrigin()),
    title: {
      default: HOME_METADATA.title,
      template: "%s",
    },
    description: HOME_METADATA.description,
    applicationName: "BizPilot AI",
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "BizPilot AI",
      title: HOME_METADATA.title,
      description: HOME_METADATA.description,
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_METADATA.title,
      description: HOME_METADATA.description,
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full min-w-0 overflow-x-hidden">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
