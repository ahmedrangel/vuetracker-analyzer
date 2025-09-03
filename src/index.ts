import { URL } from "node:url";
import puppeteer, { type Browser, type ConnectOptions, type HTTPResponse } from "puppeteer";
import tldParser from "tld-extract";
import { consola } from "consola";
import pkg from "../package.json" with { type: "json" };
import { ERROR_CODES, isCrawlable, puppeteerArgs, puppeteerViewport } from "./utils";
import { getFramework, getNuxtMeta, getNuxtModules, getPlugins, getUI, getVueMeta, hasVue, getServer } from "./tools";
import type { SiteInfo } from "./types";

let browser: Browser | null = null;

const puppeteerDefaultArgs = {
  args: puppeteerArgs,
  defaultViewport: puppeteerViewport,
  ignoreHTTPSErrors: true
};

export async function analyze (originalUrl: string, options: { browserWSEndpoint?: ConnectOptions["browserWSEndpoint"], userAgent?: string, executablePath?: string } = {}) {
  // Parse url
  let url;
  try {
    url = new URL(originalUrl);
  }
  catch (e) {
    const error = new Error(`Invalid URL ${originalUrl}`, {
      cause: { code: ERROR_CODES.INVALID_URL }
    });
    throw error;
  }
  // Start browser if not launched
  if (!browser) {
    if (options.browserWSEndpoint) {
      browser = await puppeteer.connect({
        browserWSEndpoint: options.browserWSEndpoint,
        ...puppeteerDefaultArgs
      });
    }
    else {
      browser = await puppeteer.launch({
        ...options.executablePath && { executablePath: options.executablePath },
        ...puppeteerDefaultArgs
      });
    }
    browser.on("disconnected", () => {
      browser = null;
    });
  }

  originalUrl = url.protocol + "//" + url.hostname + (url.port ? `:${url.port}` : "") + url.pathname;
  let domain;
  if (url.hostname === "localhost" || url.hostname.match(/^((2((5[0-5])|([0-4]\d)))|([0-1]?\d{1,2}))(\.((2((5[0-5])|([0-4]\d)))|([0-1]?\d{1,2}))){3}$/)) {
    domain = url.hostname;
  }
  else {
    domain = tldParser(url.origin).domain;
  }

  const page = await browser.newPage();
  const infos: SiteInfo = {
    url: originalUrl,
    hostname: url.hostname,
    domain: domain,
    meta: {
      language: "",
      title: "",
      description: "",
      siteName: "",
      isAdultContent: false,
      icons: [], // { url, sizes },
      ogImage: null
    },
    vueVersion: null,
    hasSSR: false, // default
    isStatic: undefined, // default
    framework: null, // nuxt | gridsome | quasar | vuepress | iles
    frameworkModules: [],
    plugins: [], // vue-router, vuex, vue-apollo, etc
    ui: null, // vuetify | bootstrap-vue | element-ui | tailwindcss
    server: null // cloudflare | vercel | netlify | deno | apache
  };
  try {
    await page.setCacheEnabled(false); // disable cache for avoiding 304
    await page.setUserAgent(options?.userAgent || `VueTracker/${pkg.version}`);
    await page.setViewport({
      width: 1024, // 1024 because sometimes vue is not detected when width is too small
      height: 100, // 100 for better performance
      deviceScaleFactor: 1
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false
      });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5]
      });
    });
    await page.browserContext().setCookie({
      name: "gtm_cookie_consent",
      value: "functional:1|analytics:1|customization:1|advertising:1",
      domain: url.hostname
    });
    // https://github.com/puppeteer/puppeteer/blob/v2.1.0/docs/api.md#pagegotourl-options
    let response: HTTPResponse | null;
    try {
      consola.info(`Analyzing ${originalUrl}`);
      response = await page.goto(originalUrl, {
        waitUntil: "networkidle0",
        timeout: 20000
      });
    }
    catch (err) {
      response = await page.goto(originalUrl, {
        waitUntil: "domcontentloaded"
      });
    }

    if (!response?.ok()) {
      const error = new Error(`Website responded with ${response?.status()} status code`, {
        cause: { code: ERROR_CODES.HTTP_ERROR, statusCode: response?.status(), body: await response?.text() }
      });
      throw error;
    }
    // Get headers
    const headers = response.headers();

    if (!(await isCrawlable(headers))) {
      const error = new Error(`Crawling is not allowed on ${originalUrl}`, {
        cause: { code: ERROR_CODES.NOT_CRAWLABLE }
      });
      throw error;
    }
    // Get page scripts urls
    const pageScripts = await page.evaluateHandle(() => Array.from(document.getElementsByTagName("script")).map(({ src }) => src));
    const scripts = (await pageScripts.jsonValue()).filter(script => script);

    // Original HTML sent back
    const originalHtml = await response.text();

    // Get page html
    const html = await page.content();

    // Use for detection
    const context = { originalHtml, html, scripts, page, headers };
    const contextHasVue = await hasVue(context);
    if (!contextHasVue) {
      const error = new Error(`Vue is not detected on ${originalUrl}`, {
        cause: { code: ERROR_CODES.VUE_NOT_DETECTED }
      });
      throw error;
    }

    const currentUrl = page.url();
    if (currentUrl !== originalUrl) {
      infos.url = currentUrl;
      infos.hostname = new URL(currentUrl).hostname;
      infos.domain = tldParser(currentUrl).domain;
    }
    infos.meta.title = await page.title();
    infos.meta.description = await page.$eval("head > meta:is([property=\"description\"], [name=\"description\"])", element => element.content).catch(() => null);
    infos.meta.siteName = await page.$eval("head > meta:is([property=\"og:site_name\"], [name=\"og:site_name\"])", element => element.content).catch(() => null);

    infos.meta.icons = await page.$$eval("head > link:is([rel=\"icon\"], [rel=\"shortcut icon\"])", elements => elements.map(element => ({
      url: element.href,
      sizes: element.sizes?.value || null
    }))?.sort((a, b) => (Number(b.sizes?.split("x")[0]) || 0) - (Number(a.sizes?.split("x")[0]) || 0))).catch(() => []);

    infos.meta.ogImage = await page.$eval("head > meta:is([property=\"og:image\"], [name=\"og:image\"])", element => element.content).catch(() => null);

    // Is adult website?
    const rtaLabel = await page.$eval("head > meta[name=\"rating\"]", element => element.content).catch(() => null);
    if (rtaLabel && ["adult", "RTA-5042-1996-1400-1577-RTA"].includes(rtaLabel?.trim())) {
      infos.meta.isAdultContent = true;
    }

    // Get page language
    const matches = html.match(new RegExp("<html[^>]*[: ]lang=\"([a-z]{2}((-|_)[A-Z]{2})?)\"", "i"));
    if (matches && matches.length) {
      infos.meta.language = matches[1].split("-")[0];
    }

    // Get Vue version
    if (contextHasVue) {
      const vueVersionDetector = "window?.Vue?.version || [...document.querySelectorAll(\"*\")].map((el) => el?.__vue__?.$root?.constructor?.version || el?.__vue__?.$root?.$options?._base?.version || el?.__vue_app__?.version).filter(Boolean)?.[0]";
      const fn = await page.waitForFunction(vueVersionDetector, { timeout: 20000 });
      const version = await fn.jsonValue() as string;
      if (version) infos.vueVersion = version;
    }

    // Get Vue metas
    const { ssr } = await getVueMeta(context);
    infos.hasSSR = ssr;

    // Get Vue ecosystem infos
    infos.framework = await getFramework(context);
    infos.plugins = (await getPlugins(context))?.sort((a, b) => a.name.localeCompare(b.name));
    infos.ui = await getUI(context);

    // Get Nuxt modules if using Nuxt
    if (infos.framework && infos.framework.slug === "nuxtjs") {
      const [meta, modules] = await Promise.all([
        getNuxtMeta(context),
        getNuxtModules(context)
      ]);
      infos.framework.version = await page.evaluate("window?.__unctx__?.get('nuxt-app')?.use()?.versions?.nuxt") as string;
      if (!infos.framework.version && infos.vueVersion) {
        infos.framework.version = infos.vueVersion.split(".")[0];
      }
      infos.isStatic = meta.static;
      infos.hasSSR = meta.ssr;
      infos.frameworkModules = modules?.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Get Astro version if using Astro
    else if (infos.framework && infos.framework.slug === "astro") {
      infos.framework.version = await page.evaluate("document.querySelector('meta[name=\"generator\"]')?.getAttribute('content')") as string;
      if (infos.framework.version && infos.framework.version.includes("Astro")) {
        infos.framework.version = infos.framework.version.replace("Astro v", "");
      }
    }
  
    infos.server = await getServer(context);
  
    await page.close();
    consola.success(`Done analyzing ${originalUrl}`);
    return infos;
  }
  catch (err) {
    await page.close();
    throw err;
  }
}

export async function close () {
  if (browser) {
    await browser.close();
  }
}
