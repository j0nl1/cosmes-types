import { spawnSync } from "node:child_process";
import { defineConfig } from "tsup";

/**
 * @see https://tsup.egoist.dev/#usage
 */
export default defineConfig({
  dts: false,
  shims: true,
  bundle: false,
  outDir: "build",
  platform: "neutral",
  target: "esnext",
  format: ["esm", "cjs"],
  treeshake: false,
  entry: ["protobufs/**"],
  async onSuccess() {
    console.log("Generating types...");
    spawnSync("tsup", ["protobufs/index.ts", "--dts-only"]);
  },
});
