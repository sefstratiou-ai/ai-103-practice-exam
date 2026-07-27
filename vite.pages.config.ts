import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const staticSiteRoot = fileURLToPath(new URL("./static-site/", import.meta.url));
const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
const outputDirectory = fileURLToPath(new URL("./out/", import.meta.url));

function normalizeBasePath(value: string | undefined) {
  if (!value || value === "/") {
    return "/";
  }

  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/g, "")}/${path.replace(/^\/+/, "")}`;
}

export default defineConfig(() => {
  const base = normalizeBasePath(process.env.PAGES_BASE_PATH);
  const configuredSiteUrl = process.env.PAGES_BASE_URL?.replace(/\/+$/g, "");
  const siteUrl = configuredSiteUrl || base;
  const socialImageUrl = joinUrl(siteUrl, "og.png");

  return {
    root: staticSiteRoot,
    base,
    publicDir: publicDirectory,
    plugins: [
      react(),
      {
        name: "github-pages-metadata",
        transformIndexHtml(html) {
          return html
            .replaceAll("__PAGES_SITE_URL__", siteUrl)
            .replaceAll("__PAGES_SOCIAL_IMAGE_URL__", socialImageUrl);
        },
      },
    ],
    build: {
      outDir: outputDirectory,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": projectRoot,
      },
    },
  };
});
