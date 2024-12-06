declare module "tld-extract" {
  export default function tldExtract (url: string): {
    tld: string;
    domain: string;
    subdomain: string;
  };
}