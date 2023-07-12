// @ts-check

/**
 * This script generates the src/protobufs directory from the proto files in the
 * repos specified in `REPOS`. It uses `buf` to generate TS files from the proto
 * files, and then generates an `index.ts` file to re-export the generated code.
 */

import { spawnSync } from "child_process";
import degit from "degit";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { globSync } from "glob";
import _ from "lodash";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * @typedef Repo
 * @type {object}
 * @property {string} repo - Git repo and branch to clone
 * @property {string[]} paths - Paths to proto files relative to the repo root
 */

/**
 * TODO: Add more repos here when necessary.
 * @type {Repo[]}
 */
const REPOS = [
  {
    repo: "cosmos/cosmos-sdk#main",
    paths: ["proto"],
  },
  {
    repo: "CosmWasm/wasmd#main",
    paths: ["proto"],
  },
  {
    repo: "osmosis-labs/osmosis",
    paths: ["proto"],
  },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTOBUFS_DIR = join(__dirname, "..", "src", "protobufs");
const TMP_DIR = join(PROTOBUFS_DIR, ".tmp");
/** Generates a unique dirname from `repo` to use in `TMP_DIR`. */
const id = (/** @type {string} */ repo) => repo.replace(/[#/]/g, "-");

console.log("Initialising directories...");
rmSync(PROTOBUFS_DIR, { recursive: true, force: true });
rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(PROTOBUFS_DIR);
mkdirSync(TMP_DIR);

console.log("Cloning required repos...");
await Promise.all(
  REPOS.map(({ repo }) => degit(repo).clone(join(TMP_DIR, id(repo))))
);

console.log("Generating TS files from proto files...");
for (const { repo, paths } of REPOS) {
  for (const path of paths) {
    spawnSync("pnpm", ["buf", "generate", join(TMP_DIR, id(repo), path)], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }
  console.log(`✔️ [${repo}]`);
}

console.log("Generating src/index.ts file and renaming exports...");
const LAST_SEGMENT_REGEX = /[^/]+$/;
const EXPORTED_NAME_REGEX = /^export \w+ (\w+) /gm;
let contents =
  "/** This file is generated by gen-protobufs.mjs. Do not edit. */\n\n";
/**
 * Builds the `src/proto/index.ts` file to re-export generated code.
 * A prefix is added to the exported names to avoid name collisions.
 * The prefix is the names of the directories in `proto` leading up
 * to the directory of the exported code, concatenated in PascalCase.
 * For example, if the exported code is in `proto/foo/bar/goo.ts`, the
 * prefix will be `FooBar`.
 * @param {string} dir
 */
function generateIndexExports(dir) {
  const files = globSync(join(dir, "*"));
  if (files.length === 0) {
    return;
  }
  const prefixName = dir
    .replace(PROTOBUFS_DIR + "/", "")
    .split("/")
    .map((name) =>
      // convert name to PascalCase
      name
        .split("-")
        .map((str) => _.capitalize(str))
        .join("")
    )
    .join("");
  for (const file of files) {
    const fileName = file.match(LAST_SEGMENT_REGEX)?.[0];
    if (!fileName) {
      console.error("Could not find name for", file);
      continue;
    }
    if (!fileName.endsWith(".ts")) {
      continue;
    }
    const code = readFileSync(file, "utf8");
    contents += `export {\n`;
    for (const match of code.matchAll(EXPORTED_NAME_REGEX)) {
      const exportedName = match[1];
      contents += `  ${exportedName} as ${prefixName + exportedName},\n`;
    }
    const exportedFile = file
      .replace(PROTOBUFS_DIR + "/", "")
      .replace(".ts", ".js");
    contents += `} from "./${exportedFile}";\n`;
  }
  for (const file of files) {
    generateIndexExports(file);
  }
}
generateIndexExports(PROTOBUFS_DIR);
writeFileSync(join(PROTOBUFS_DIR, "index.ts"), contents);

console.log("Cleaning up...");
rmSync(TMP_DIR, { recursive: true, force: true });

console.log("Proto generation completed successfully!");
