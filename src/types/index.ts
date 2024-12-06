import type { Page } from "puppeteer";

export interface SiteIcons {
  url: string;
  sizes: string | null;
}

export interface Technology {
  slug: string;
  name: string;
  icon: string | null;
  version?: string | null;
}

export interface SiteInfo {
  url: string;
  hostname: string;
  domain: string;
  meta: {
    language: string;
    title: string;
    description: string | null;
    siteName: string | null;
    isAdultContent: boolean;
    icons: SiteIcons[];
    ogImage: string | null;
  };
  vueVersion: string | null;
  hasSSR: boolean;
  isStatic: boolean;
  framework: Technology | null;
  frameworkModules: Technology[];
  plugins: Technology[];
  ui: Technology | null;
}

export interface Detector {
  html?: string | string[];
  js?: string | string[];
  script?: string[];
  headers?: Record<string, string>;
  originalHtml?: string;
}

export interface DetectorContext {
  originalHtml: string;
  html: string;
  scripts: string[];
  page: Page;
  headers?: Record<string, string>;
}

export interface TechnologyProps {
  metas: Technology;
  detectors: Detector;
  priority?: number;
}

export interface TechnologyDetectorData {
  [key: string]: TechnologyProps;
}

export interface NuxtMeta {
  ssr: {
    js: string;
  };
  static: {
    js: string;
  };
}

export interface VueMeta {
  ssr: {
    originalHtml?: string;
    html?: string[];
  };
}
