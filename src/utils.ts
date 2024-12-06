export const ERROR_CODES = Object.freeze({
  INVALID_URL: 1,
  HTTP_ERROR: 2,
  NOT_CRAWLABLE: 3,
  VUE_NOT_DETECTED: 4
});

export const asArray = (value: string | string[]) => value instanceof Array ? value : [value];

// Src: https://github.com/AliasIO/wappalyzer/blob/master/src/wappalyzer.js
export function parsePatterns (patterns: string | string[] | { main: string | string[] }) {
  if (!patterns) {
    return [];
  }

  let mainParsed: { string: string, regex: RegExp }[] = [];
  let parsed: { [key: string]: { string: string, regex: RegExp }[] } = {};

  // Convert string to object containing array containing string
  if (typeof patterns === "string" || patterns instanceof Array) {
    patterns = {
      main: asArray(patterns)
    };
  }


  Object.keys(patterns).forEach((key) => {
    parsed[key] = [];
    asArray(patterns[key as keyof typeof patterns]).forEach((pattern) => {
      const attrs: { string: string, regex: RegExp } = { string: "", regex: new RegExp("") };
      pattern.split("\\;").forEach((attr, i) => {
        if (i) {
          // Key value pairs
          const parts = attr.split(":");
          const key = parts.shift();
          if (attr.length > 1 && key === "string") {
            attrs[key] = parts.join(":");
          }
        }
        else {
          attrs.string = attr;
          try {
            attrs.regex = new RegExp(attr.replace("/", "\/"), "i"); // Escape slashes in regular expression
          }
          catch (error) {
            attrs.regex = new RegExp("");
            console.info(`${(error as Error).message}: ${attr}`, "error", "core");
          }
        }
      });
      parsed[key].push(attrs);
    });
  });
  // Convert back to array if the original pattern list was an array (or string)
  if ("main" in parsed) {
    mainParsed = parsed.main;
  }
  return mainParsed;
}

export async function isCrawlable (htmlHeaders: Record<string, string>) {
  const tag = htmlHeaders["x-robots-tag"];
  const patterns = /noindex|none/;

  return tag ? !patterns.test(tag) : true;
}

// From https://github.com/alixaxel/chrome-aws-lambda/blob/master/source/index.js#L83
export const puppeteerArgs = [
  "--autoplay-policy=user-gesture-required",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-dev-shm-usage",
  "--disable-domain-reliability",
  "--disable-extensions",
  "--disable-features=AudioServiceOutOfProcess",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-notifications",
  "--disable-offer-store-unmasked-wallet-cards",
  "--disable-popup-blocking",
  "--disable-print-preview",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--disable-speech-api",
  "--disable-sync",
  "--disk-cache-size=33554432",
  "--hide-scrollbars",
  "--ignore-gpu-blacklist",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--no-pings",
  "--no-zygote",
  "--password-store=basic",
  "--use-gl=swiftshader",
  "--use-mock-keychain",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--headless",
  "--disable-gpu",
  "--window-size=100,100"
];
export const puppeteerViewport = {
  deviceScaleFactor: 1,
  hasTouch: false,
  height: 100,
  isLandscape: true,
  isMobile: false,
  width: 100
};
