// Node ESM resolve hook: lets Node import the Next.js app's extensionless
// relative imports (e.g. './prisma') when running scripts directly.
// App code stays untouched; only this test harness uses the hook.
export async function resolve(specifier, context, nextResolve) {
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
    throw err;
  }
}
