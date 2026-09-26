function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "section";
}

function inline(text, resolveLink) {
  const code = [];
  let safe = escapeHtml(text).replace(/`([^`]+)`/g, (_match, value) => {
    const token = `\u0000${code.length}\u0000`;
    code.push(`<code>${value}</code>`);
    return token;
  });
  safe = safe.replace(/(!?)\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+"([^"]*)")?\)/g, (_match, imageMark, label, rawTarget, title) => {
    const target = rawTarget.startsWith("<") ? rawTarget.slice(1, -1) : rawTarget;
    const resolution = resolveLink?.(target, { image: Boolean(imageMark), label }) ?? null;
    const safeLabel = escapeHtml(label);
    if (!resolution || resolution.kind === "outside") {
      const value = resolution?.path ?? target;
      return `<span class="outside-path"><code>${escapeHtml(value)}</code><button type="button" data-copy-value="${escapeHtml(value)}">복사</button></span>`;
    }
    if (resolution.kind === "image") {
      const src = escapeHtml(resolution.src);
      const caption = safeLabel || escapeHtml(target);
      return `<button class="markdown-image" type="button" data-image-path="${escapeHtml(resolution.path)}" data-image-session="${escapeHtml(resolution.session)}" aria-label="${caption}"><img src="${src}" alt="${caption}" loading="lazy"><span>${caption}</span></button>`;
    }
    if (resolution.kind === "external") return `<a href="${escapeHtml(resolution.href)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ""}>${safeLabel || escapeHtml(target)}</a>`;
    if (resolution.kind === "anchor") return `<a href="${escapeHtml(resolution.href)}">${safeLabel || escapeHtml(target)}</a>`;
    const routeValue = typeof resolution.route === "string" && /^#\/s\/[^\s"'<>]+$/.test(resolution.route) ? resolution.route : "";
    if (!routeValue) return `<span>${safeLabel || escapeHtml(target)}</span>`;
    const route = escapeHtml(routeValue);
    const attrs = `href="${route}" data-journal-route="${route}"`;
    return `<a ${attrs}${title ? ` title="${escapeHtml(title)}"` : ""}>${safeLabel || escapeHtml(target)}</a>`;
  });
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/~~([^~]+)~~/g, "<del>$1</del>");
  safe = safe.replace(/\u0000(\d+)\u0000/g, (_match, index) => code[Number(index)] ?? "");
  return safe;
}

export function renderMarkdown(markdown, resolveLink) {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const html = [];
  const headings = [];
  let paragraph = [];
  const listStack = [];
  let table = null;
  let codeLines = null;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map((line) => inline(line, resolveLink)).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    while (listStack.length) {
      const entry = listStack.pop();
      if (entry.itemOpen) html.push("</li>");
      html.push(`</${entry.type}>`);
    }
  };
  const openList = (type, indent) => {
    html.push(`<${type}>`);
    listStack.push({ type, indent, itemOpen: false });
  };
  const flushTable = () => {
    if (!table) return;
    const [header, ...rows] = table;
    html.push(`<div class="table-scroll"><table><thead><tr>${header.map((cell) => `<th scope="col">${inline(cell.trim(), resolveLink)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell.trim(), resolveLink)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    table = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (codeLines) {
      if (/^\s*```/.test(line)) {
        html.push(`<pre tabindex="0" aria-label="코드 블록"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else codeLines.push(line);
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushList(); flushTable();
      codeLines = [];
      continue;
    }
    if (!line.trim()) {
      flushParagraph(); flushList(); flushTable();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph(); flushList(); flushTable();
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slug(title);
      if (level === 2) headings.push({ title, id });
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(title, resolveLink)}</h${level}>`);
      continue;
    }
    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph(); flushList(); flushTable(); html.push("<hr>"); continue;
    }
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) {
      flushParagraph(); flushList();
      if (html.length && /^<p>/.test(html.at(-1))) {
        const headerLine = lines[lineIndex - 1] ?? "";
        html.pop();
        const header = headerLine.replace(/^\s*\||\|\s*$/g, "").split("|");
        table = [header];
      }
      continue;
    }
    if (table) {
      table.push(line.replace(/^\s*\||\|\s*$/g, "").split("|"));
      continue;
    }
    const list = line.match(/^([\t ]*)(?:([-+*])|(\d+)\.)[\t ]+(.+)$/);
    if (list) {
      flushParagraph(); flushTable();
      const indent = list[1].replaceAll("\t", "    ").length;
      const nextType = list[3] ? "ol" : "ul";
      while (listStack.length && listStack.at(-1).indent > indent) {
        const entry = listStack.pop();
        if (entry.itemOpen) html.push("</li>");
        html.push(`</${entry.type}>`);
      }
      let current = listStack.at(-1);
      if (current?.indent === indent) {
        if (current.type !== nextType) {
          if (current.itemOpen) html.push("</li>");
          html.push(`</${current.type}>`);
          listStack.pop();
          current = null;
        } else if (current.itemOpen) {
          html.push("</li>");
          current.itemOpen = false;
        }
      }
      if (!current || indent > current.indent) openList(nextType, indent);
      const entry = listStack.at(-1);
      html.push(`<li>${inline(list[4], resolveLink)}`);
      entry.itemOpen = true;
      continue;
    }
    flushList(); flushTable();
    if (/^>\s?/.test(line)) {
      flushParagraph(); html.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ""), resolveLink)}</p></blockquote>`); continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); flushList(); flushTable();
  if (codeLines) html.push(`<pre tabindex="0" aria-label="코드 블록"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return { html: html.join("\n"), headings };
}

export { escapeHtml };
