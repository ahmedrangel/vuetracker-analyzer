import { asArray, parsePatterns } from "./utils.js";
import vue from "./detectors/technology/vue.json" with { type: "json" };
import vueMeta from "./detectors/meta/vue.meta.json" with { type: "json" };
import frameworks from "./detectors/technology/frameworks.json" with { type: "json" };
import plugins from "./detectors/technology/plugins.json" with { type: "json" };
import uis from "./detectors/technology/uis.json" with { type: "json" };
import nuxtMeta from "./detectors/meta/nuxt.meta.json" with { type: "json" };
import nuxtModules from "./detectors/technology/nuxt.modules.json" with { type: "json" };
import servers from "./detectors/technology/servers.json" with { type: "json" };
import type { Detector, DetectorContext, NuxtMeta, Technology, TechnologyDetectorData, TechnologyProps, VueMeta } from "./types/index";

const detectors = {
  vue: vue as TechnologyProps,
  meta: vueMeta as VueMeta,
  frameworks: frameworks as TechnologyDetectorData,
  plugins: plugins as TechnologyDetectorData,
  uis: uis as TechnologyDetectorData,
  nuxt: {
    meta: nuxtMeta as NuxtMeta,
    modules: nuxtModules as TechnologyDetectorData
  },
  servers: servers as TechnologyDetectorData
};

export function hasVue (context: DetectorContext) {
  return isMatching(detectors.vue.detectors, context);
}

export async function getVueMeta (context: DetectorContext) {
  const meta: { ssr: boolean } = { ssr: false };
  await Promise.all(
    Object.keys(detectors.meta).map(async (key) => {
      meta[key as keyof typeof meta] = await isMatching(detectors.meta[key as keyof VueMeta], context);
    })
  );
  return meta;
}

export async function getFramework (context: DetectorContext) {
  for (const framework of Object.keys(detectors.frameworks)) {
    if (await isMatching(detectors.frameworks[framework].detectors, context)) {
      return detectors.frameworks[framework].metas;
    }
  }
  return null;
}

export async function getUI (context: DetectorContext) {
  const uis = new Set<TechnologyProps>();

  await Promise.all(
    Object.keys(detectors.uis).map(async (ui) => {
      if (await isMatching(detectors.uis[ui].detectors, context)) {
        uis.add(detectors.uis[ui]);
      }
    })
  );

  const ui = Array.from(uis).sort((a, b) => (typeof b.priority !== "undefined" ? b.priority : 1) - (typeof a.priority !== "undefined" ? a.priority : 1))[0];
  if (ui) {
    return ui.metas;
  }
  return null;
}

export async function getPlugins (context: DetectorContext) {
  const plugins = new Set<Technology>();

  await Promise.all(
    Object.keys(detectors.plugins).map(async (plugin) => {
      if (await isMatching(detectors.plugins[plugin].detectors, context)) {
        plugins.add(detectors.plugins[plugin].metas);
      }
    })
  );

  return Array.from(plugins);
}

export async function getNuxtMeta (context: DetectorContext) {
  const meta: { ssr: boolean, static: boolean } = { ssr: false, static: true };

  await Promise.all(
    Object.keys(detectors.nuxt.meta).map(async (key) => {
      meta[key as keyof typeof meta] = await isMatching(detectors.nuxt.meta[key as keyof NuxtMeta], context);
    })
  );

  return meta;
}

export async function getNuxtModules (context: DetectorContext) {
  const modules = new Set<Technology>();

  await Promise.all(
    Object.keys(detectors.nuxt.modules).map(async (name) => {
      if (await isMatching(detectors.nuxt.modules[name].detectors, context)) {
        modules.add(detectors.nuxt.modules[name].metas);
      }
    })
  );

  return Array.from(modules);
}

async function isMatching (detector: Detector, { originalHtml, html, scripts, page, headers }: DetectorContext) {
  // If we can detect technology from response html
  if (detector.originalHtml) {
    for (const pattern of parsePatterns(detector.originalHtml)) {
      if (pattern.regex.test(originalHtml)) return true;
    }
  }
  // If we can detect technology from html
  if (detector.html) {
    for (const pattern of parsePatterns(detector.html)) {
      if (pattern.regex.test(html)) return true;
    }
  }
  // Check with scripts src
  if (detector.script) {
    for (const pattern of parsePatterns(detector.script)) {
      for (const uri of scripts) {
        if (pattern.regex.test(uri)) return true;
      }
    }
  }
  // Or JS evaluation
  if (detector.js) {
    for (const js of asArray(detector.js)) {
      try {
        if (await page.evaluate(`Boolean(${js})`)) return true;
      }
      catch (e) {}
    }
  }
  // If we can detect technology from headers
  if (headers && detector.headers && typeof detector.headers === "object" && Object.keys(detector.headers).length > 0) {
    for (const header of Object.keys(headers)) {
      if (Object.keys(detector.headers).find(key => key.toLowerCase() === header.toLowerCase())) {
        const detectorHeader = detector.headers[header];
        if (typeof detectorHeader === "string" && detectorHeader.toLowerCase() === headers[header].toLowerCase()) return true;
        else if (detectorHeader === true) return true;
      }
    }
  }
  return false;
}

export async function getServer (context: DetectorContext) {
  for (const server of Object.keys(detectors.servers)) {
    if (await isMatching(detectors.servers[server].detectors, context)) {
      return detectors.servers[server].metas;
    }
  }
  return null;
}
