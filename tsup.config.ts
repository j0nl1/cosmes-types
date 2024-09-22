import { defineConfig } from "tsup";

/**
 * @see https://tsup.egoist.dev/#usage
 */
export default defineConfig({
  dts: true,
  shims: true,
  bundle: true,
  outDir: "build",
  platform: "neutral",
  target: "esnext",
  format: ["esm", "cjs"],
  treeshake: "recommended",
  entry: ["protobufs/index.ts"],
});
