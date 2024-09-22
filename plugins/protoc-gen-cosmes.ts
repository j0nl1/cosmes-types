#!/usr/bin/env -S npx tsx
// @ts-check

/**
 * This is a custom plugin for `buf` that generates TS files from the services
 * defined in the proto files, and is referred to by the root `buf.gen.yaml`.
 * Files generated using this plugin contains the `_cosmes` suffix.
 *
 * Do not convert this to a TS file as it runs 4x slower!
 */

import type { DescService } from "@bufbuild/protobuf";
import {
  type GeneratedFile,
  type Schema,
  createEcmaScriptPlugin,
  runNodeJs,
  safeIdentifier,
} from "@bufbuild/protoplugin";

export function generateTs(schema: Schema) {
  for (const protoFile of schema.files) {
    const file = schema.generateFile(protoFile.name + "_cosmes.ts");
    file.preamble(protoFile);
    for (const service of protoFile.services) {
      generateService(file, service);
    }
  }
}

function generateService(f: GeneratedFile, service: DescService) {
  f.print("const TYPE_NAME = ", f.string(service.typeName), ";");
  f.print("");
  for (const method of service.methods) {
    const inputType = f.importShape(method.input);
    const inputDesc = f.importSchema(method.input);
    const outputType = f.importShape(method.output);
    const outputDesc = f.importSchema(method.output);
    f.print(f.jsDoc(method));
    const { toBinary, fromBinary, toJson, create } = f.runtime;
    f.print(f.export("const", safeIdentifier(service.name + method.name + "Service")), "= {");
    f.print("  typeName: TYPE_NAME,");
    f.print("  method: ", f.string(method.name), ",");
    f.print("  request: {");
    f.print("      toBinary(msg: Omit<", inputType, ", '$unknown' | '$typeName'>) {");
    f.print("        return ", toBinary, "(", inputDesc, ",", create, "(", inputDesc, ", msg));");
    f.print("      },");
    f.print("      fromBinary(bytes: Uint8Array) {");
    f.print("        return ", fromBinary, "(", inputDesc, ", bytes);");
    f.print("      }");
    f.print("  },");
    f.print("  response: {");
    f.print("      toBinary(msg: Omit<", outputType, ", '$unknown' | '$typeName'>) {");
    f.print("        return ", toBinary, "(", outputDesc, ",", create, "(", outputDesc, ", msg));");
    f.print("    },");
    f.print("    fromBinary(bytes: Uint8Array) {");
    // biome-ignore format: no formatting
    f.print("      return ", toJson, "(", outputDesc, ",", fromBinary, "(", outputDesc, ", bytes));");
    f.print("    }");
    f.print("  }");
    f.print("} as const;");
    f.print("");
  }
}

runNodeJs(
  createEcmaScriptPlugin({
    name: "protoc-gen-cosmes",
    version: "v0.0.1",
    generateTs,
  }),
);
