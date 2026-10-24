/* global __dirname */
const esbuild = require("../node_modules/esbuild");
const path = require("node:path");
const fs = require("node:fs");
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
for (const name of ["index.html", "app.html"])
  fs.copyFileSync(
    path.join(__dirname, name),
    path.join(__dirname, "dist", name),
  );
const root = path.resolve(__dirname, "..");
esbuild
  .build({
    entryPoints: [path.join(__dirname, "entry.tsx")],
    outfile: path.join(__dirname, "dist/app.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', __DEV__: "true" },
    alias: {
      react: path.join(root, "node_modules/react"),
      "react-dom": path.join(root, "node_modules/react-dom"),
      "react-native": path.join(__dirname, "native.tsx"),
      "react-native-web": path.join(__dirname, "node_modules/react-native-web"),
      "react-native-safe-area-context": path.join(__dirname, "adapters.tsx"),
      "expo-status-bar": path.join(__dirname, "adapters.tsx"),
      "expo-crypto": path.join(__dirname, "adapters.tsx"),
    },
    plugins: [
      {
        name: "mock-native-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^\.\.\/(product\/(storage|review)|storage\/sqlite|services)$/,
            },
            () => ({ path: path.join(__dirname, "adapters.tsx") }),
          );
        },
      },
    ],
  })
  .catch(() => process.exit(1));
