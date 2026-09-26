const IMAGE_PATH = /\.(?:jpe?g|png)$/i;

export function pathsForSession(changedPaths, session) {
  if (!session) return [];
  const paths = Array.isArray(changedPaths) ? changedPaths : [changedPaths ?? ""];
  const prefix = `${session}/`;
  return paths.flatMap((changedPath) => {
    if (typeof changedPath !== "string") return [];
    if (!changedPath || changedPath === session) return [""];
    return changedPath.startsWith(prefix) ? [changedPath.slice(prefix.length)] : [];
  });
}

export function shouldRefreshLightbox(paths, current, pinned) {
  if (!paths.length) return false;
  const images = [current, pinned].filter(Boolean);
  return paths.some((changedPath) => {
    if (!changedPath) return true;
    if (IMAGE_PATH.test(changedPath)) return true;
    return images.some((image) => {
      const folder = image.folder;
      return (folder && (changedPath === folder || changedPath.startsWith(`${folder}/`))) || image.group?.requestFile === changedPath;
    });
  });
}

export function imageIndexFor(images, image, previousIndex = 0) {
  const session = image?.session;
  const index = images.findIndex((item) => item.path === image?.path && (item.session ?? session) === session);
  if (index >= 0) return index;
  return images.length ? Math.min(Math.max(0, previousIndex), images.length - 1) : 0;
}
