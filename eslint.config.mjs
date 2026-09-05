import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    settings: {
      react: {
        version: "19",
      },
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // File generati automaticamente da Prisma
    "prisma/contract.d.ts",
    "migrations/snapshots/**/contract.d.ts",
  ]),
]);

export default eslintConfig;