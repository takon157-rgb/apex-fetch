// Node ESM resolve hook: lets Node import the Next.js app's extensionless
// relative imports (e.g. './prisma') and its "@/..." path alias when running
// scripts directly. App code stays untouched; only this test harness uses the
// hook.
const ROOT = new URL('../', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  // The app's "@/lib/x" alias -> <project root>/lib/x
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const candidates = [`${rel}.ts`, `${rel}/index.ts`, rel];
    for (const candidate of candidates) {
      try {
        return await nextResolve(new URL(candidate, ROOT).href, context);
      } catch {
        // try the next candidate
      }
    }
    throw new Error(`Cannot resolve alias import "${specifier}"`);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$|\.json$/i.test(specifier)) {
      try {
        return await nextResolve(specifier + '.ts', context);
      } catch {
        try {
          return await nextResolve(specifier + '/index.ts', context);
        } catch {
          throw err;
        }
      }
    }

    // Node's ESM resolver does not add extensions to package subpaths, so
    // "next/server" has to become "next/server.js" before it resolves.
    if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !/\.[cm]?[jt]sx?$|\.json$/i.test(specifier)) {
      for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
        try {
          return await nextResolve(candidate, context);
        } catch {
          // try the next candidate
        }
      }
    }

    throw err;
  }
}
