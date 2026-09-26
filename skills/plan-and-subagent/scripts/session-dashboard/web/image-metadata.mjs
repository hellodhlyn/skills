function normalize(value) {
  return ` ${String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function hasToken(value, token) {
  const normalizedToken = normalize(token).trim();
  return Boolean(normalizedToken && value.includes(` ${normalizedToken} `));
}

export function resolveImageViewport(imagePath, viewports = []) {
  const basename = String(imagePath ?? "").split("/").at(-1)?.replace(/\.(?:jpe?g|png)$/i, "") ?? "";
  const label = normalize(basename.replace(/^\d{3}-/, ""));
  const matches = viewports.filter((viewport) => {
    if (!viewport || !Number.isInteger(viewport.width)) return false;
    if (viewport.name && hasToken(label, viewport.name)) return true;
    const dimensions = viewport.height && new RegExp(`(?:^|[^0-9])${viewport.width}\\s*[x×-]\\s*${viewport.height}(?:$|[^0-9])`, "i").test(basename);
    if (dimensions) return true;
    return new RegExp(`(?:^|[^0-9])${viewport.width}(?:px)?(?:$|[^0-9])`, "i").test(basename);
  });
  return matches.length === 1 ? matches[0] : null;
}
