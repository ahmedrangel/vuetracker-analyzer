import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  entries: [
    "./src/index",
    {
      input: "src/icons/",
      outDir: "dist/icons",
      name: "icons",
      builder: "mkdist",
      format: "esm",
      ext: "mjs"
    },
    {
      input: "src/detectors/technology",
      outDir: "dist/detectors",
      name: "detectors",
      builder: "mkdist",
      format: "esm",
      ext: "mjs"
    }
  ]
});