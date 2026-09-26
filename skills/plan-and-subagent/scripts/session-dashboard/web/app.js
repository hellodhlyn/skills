import { resolveImageViewport } from "./image-metadata.mjs";
import { imageIndexFor, pathsForSession, shouldRefreshLightbox } from "./lightbox-state.mjs";

const STEP_LABELS = ["환경·작업 확정", "결정·브리프 준비", "브리프 승인", "이해 확인·구현 위임", "구현·결과 확인", "검증·리뷰", "전달·보고"];
const TABS = ["current", "images", "mockups", "runs", "documents"];
const TAB_LABELS = { current: "현재", images: "이미지", mockups: "목업", runs: "실행", documents: "문서" };
const BRIEF_GALLERY_TARGET = "@brief";
const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const sessionGroups = $("#session-groups");
const detailSection = $("#session-detail");
const loading = $("#loading");
let loadingTimer = null;
let selectedLoadId = 0;
let documentLoadId = 0;
const header = $("#page-header");
const tabsNode = $("#tabs");
const panel = $("#tab-panel");
const connection = $("#connection-state");
const lightbox = $("#lightbox");
const announcer = $("#announcer");
let wasMobileViewport = window.innerWidth < 800;

const state = {
  sessions: [], groups: { waiting: [], active: [], recent: [] }, waitingCount: 0,
  session: null, sessionData: null, tab: "current", target: "", selectedFolder: "", galleryTarget: "", selectedMockup: "", selectedDocument: "", selectedRun: "", pendingTabFocus: "", mockupWidth: null, mockupUpdated: "", documentText: null, documentChanged: false,
  currentImageSet: [], imageIndex: 0, pinnedImage: null, naturalSize: false, infoOpen: window.matchMedia("(min-width: 1200px)").matches, lightboxSession: "", lightboxData: null, lightboxScope: "folder", lightboxFolder: "", lightboxBriefPath: "",
  opener: null, openerMeta: null, eventSource: null, currentSignature: "", currentSignatureSession: "",
};

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function apiUrl(path, params = {}) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  return url;
}
async function getJson(path, params = {}) {
  const response = await fetch(apiUrl(path, params), { headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
  return result;
}
function timeElement(iso, className = "") {
  if (!iso) return `<span class="${className}">시각 없음</span>`;
  const date = new Date(iso);
  const clock = shortDateTime(date);
  if (!clock) return `<span class="${className}">시각 미상</span>`;
  const title = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
  return `<time class="${className}" datetime="${esc(date.toISOString())}" title="${esc(title)}">${clock}</time>`;
}
function shortDateTime(date) {
  if (!Number.isFinite(date.getTime())) return null;
  const twoDigits = (value) => String(value).padStart(2, "0");
  return `${twoDigits(date.getMonth() + 1)}/${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}
function relative(iso) {
  if (!iso) return "활동 시각 없음";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
function mediaUrl(session, path) { return apiUrl("/file", { session, path }).toString(); }
function routeFor(session, tab = "current", target = "") {
  return `#/s/${encodeURIComponent(session)}/${tab}/${encodeURIComponent(target)}`;
}
function routeState() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] !== "s" || !parts[1]) return null;
  try {
    return { session: decodeURIComponent(parts[1]), tab: TABS.includes(parts[2]) ? parts[2] : "current", target: parts[3] ? decodeURIComponent(parts.slice(3).join("/")) : "" };
  } catch { return null; }
}
function navigate(session, tab = "current", target = "", { replace = false } = {}) {
  const value = routeFor(session, tab, target);
  const routeChanged = session !== state.session || tab !== state.tab || target !== state.target;
  if (routeChanged) window.scrollTo(0, 0);
  if (session !== state.session) {
    state.selectedFolder = "";
    state.galleryTarget = "";
    state.selectedMockup = "";
    state.selectedDocument = "";
    state.selectedRun = "";
    state.mockupWidth = null;
  }
  if (replace) history.replaceState(null, "", value);
  else if (location.hash !== value) location.hash = value;
  state.session = session;
  state.tab = tab;
  state.target = target;
  if (window.innerWidth < 800) document.body.classList.add("detail-open");
  loadSelected();
}

function statusText(row) {
  if (row.statusKind === "missing") return `상태 파일 없음 · ${row.date || "날짜 없음"}${row.finalSummary ? " · final_summary 있음" : ""}`;
  if (row.statusKind === "error") return `상태 파일 오류 · ${row.date || "날짜 없음"}`;
  if (!row.status) return row.relativeActivity;
  const wait = row.status.waitingOn === "user" ? "사용자 대기" : row.status.waitingOn === "agent" ? "에이전트 작업 중" : "대기 없음";
  if (row.status.stage === 7 && row.status.waitingOn === "none") return `Step 7 · 종료 · ${row.relativeActivity}`;
  return `Step ${row.status.stage} · ${wait} · ${row.relativeActivity}`;
}
function statusUpdateText(iso) {
  const date = new Date(iso);
  const clock = shortDateTime(date);
  return clock ? { clock, datetime: date.toISOString() } : { clock: "시각 미상", datetime: "" };
}
function renderSessions() {
  const query = $("#session-filter").value.trim().toLocaleLowerCase();
  const labels = [["waiting", "응답 필요"], ["active", "진행 중"], ["recent", "최근"]];
  sessionGroups.innerHTML = labels.map(([key, title]) => {
    const rows = (state.groups[key] ?? []).filter((row) => `${row.title} ${row.dir} ${row.slug}`.toLocaleLowerCase().includes(query));
    return `<section class="session-group" aria-label="${title}"><h2 class="group-heading"><span>${title}</span><span class="count">${rows.length}</span></h2>${rows.length ? rows.map((row) => {
      const waiting = row.group === "waiting";
      const active = row.group === "active";
      return `<button class="session-row ${waiting ? "is-waiting" : ""}" type="button" data-session="${esc(row.dir)}" aria-current="${row.dir === state.session}"><span class="row-title">${active ? '<i class="run-dot" aria-hidden="true"></i>' : ""}${esc(row.slug)}</span><span class="row-meta">${esc(statusText(row))}</span></button>`;
    }).join("") : '<div class="empty-inline caption">세션 없음</div>'}</section>`;
  }).join("");
  document.title = `(${state.waitingCount}) plan-and-subagent 세션`;
}

function selectedRow() { return state.sessions.find((row) => row.dir === state.session); }
function renderHeader() {
  const counts = state.sessionData.counts;
  const connectionNode = connection;
  header.innerHTML = `<div class="page-title-block"><h1 class="page-title">${esc(state.sessionData.title)}</h1><div class="page-title-meta"><span class="session-path">${esc(state.session)}</span><button class="path-copy" type="button" data-copy-value="${esc(state.sessionData.absolutePath)}">경로 복사</button></div></div>`;
  header.append(connectionNode);
  tabsNode.innerHTML = TABS.map((tab) => `<button class="tab" type="button" role="tab" id="tab-${tab}" aria-controls="tab-panel" aria-selected="${state.tab === tab}" tabindex="${state.tab === tab ? "0" : "-1"}" data-tab="${tab}">${TAB_LABELS[tab]} <span class="tab-count">${counts[{ current: "", images: "images", mockups: "mockups", runs: "runs", documents: "documents" }[tab]] ?? ""}</span></button>`).join("");
}
function announceRelevantChange() {
  const waiting = state.sessionData.status?.waitingOn ?? null;
  const runs = JSON.stringify(state.sessionData.runs.map((run) => [run.dir, run.state.kind]));
  const nextStatus = JSON.stringify({ waiting, runs });
  if (state.currentSignatureSession !== state.session) {
    state.currentSignatureSession = state.session;
    state.currentSignature = nextStatus;
    return;
  }
  let previous = {};
  try { previous = JSON.parse(state.currentSignature); } catch { /* First state for this session is not announced. */ }
  const messages = [];
  if (previous.waiting !== waiting && waiting !== null) {
    messages.push(waiting === "user" ? "사용자 응답 대기" : waiting === "agent" ? "에이전트 작업 중" : waiting === "none" ? "대기 없음" : "대기 상태가 갱신되었습니다");
  }
  if (previous.runs !== runs) messages.push("실행 상태가 갱신되었습니다");
  if (messages.length) announcer.textContent = `${messages.join(". ")}.`;
  state.currentSignature = nextStatus;
}
function startLoading() {
  loading.textContent = "세션 저널을 읽고 있습니다.";
  if (!detailSection.hidden) {
    loading.hidden = true;
    return;
  }
  if (loadingTimer !== null || !loading.hidden) return;
  loadingTimer = setTimeout(() => {
    loadingTimer = null;
    if (detailSection.hidden) loading.hidden = false;
  }, 200);
}
function stopLoading() {
  clearTimeout(loadingTimer);
  loadingTimer = null;
  loading.hidden = true;
}
function showLoadingMessage(message) {
  clearTimeout(loadingTimer);
  loadingTimer = null;
  loading.textContent = message;
  loading.hidden = false;
}
async function loadSelected({ incremental = false } = {}) {
  if (!state.session) return;
  const loadId = ++selectedLoadId;
  const session = state.session;
  const scrollY = window.scrollY;
  startLoading();
  let dataLoaded = false;
  try {
    const data = await getJson("/api/session", { dir: session });
    if (loadId !== selectedLoadId || session !== state.session) return;
    dataLoaded = true;
    const previous = state.sessionData;
    state.sessionData = data;
    state.selectedFolder = state.tab === "images" && data.folders.some((item) => item.path === state.target)
      ? state.target
      : data.folders.some((item) => item.path === state.selectedFolder) ? state.selectedFolder : data.folders[0]?.path ?? "";
    if (state.tab === "images" && state.target === BRIEF_GALLERY_TARGET) state.galleryTarget = BRIEF_GALLERY_TARGET;
    else if (state.tab === "images" && data.folders.some((item) => item.path === state.target)) state.galleryTarget = state.target;
    else state.galleryTarget = BRIEF_GALLERY_TARGET;
    state.selectedMockup = (state.tab === "mockups" && data.mockups.some((item) => item.path === state.target) ? state.target : state.selectedMockup) || data.mockups[0]?.path || "";
    state.selectedDocument = (state.tab === "documents" && [...data.documents.primary, ...data.documents.groups.flatMap((group) => group.docs)].some((item) => item.path === state.target) ? state.target : state.selectedDocument) || data.documents.primary[0]?.path || data.documents.groups[0]?.docs[0]?.path || "";
    state.selectedRun = (state.tab === "runs" && data.runs.some((item) => item.dir === state.target) ? state.target : state.selectedRun) || data.runs[0]?.dir || "";
    stopLoading();
    detailSection.hidden = false;
    renderSessions();
    renderHeader();
    announceRelevantChange();
    if (incremental && previous && state.tab === "images") renderImages({ incremental: true });
    else if (incremental && previous && state.tab === "documents") renderDocumentsList();
    else renderTab();
    if (incremental) window.scrollTo(0, scrollY);
    if (state.pendingTabFocus) {
      const tab = $(`#tab-${state.pendingTabFocus}`);
      state.pendingTabFocus = "";
      tab?.focus({ preventScroll: true });
    }
  } catch {
    if (loadId !== selectedLoadId || session !== state.session) return;
    if (dataLoaded) {
      stopLoading();
      panel.innerHTML = '<div class="empty-state">세션 화면을 표시할 수 없습니다. 다시 선택해 주세요.</div>';
    } else {
      showLoadingMessage("세션을 읽을 수 없습니다. 목록에서 다시 선택해 주세요.");
      detailSection.hidden = true;
    }
  }
}

function renderTab() {
  tabsNode.querySelectorAll("[role=tab]").forEach((tab) => {
    const selected = tab.dataset.tab === state.tab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  if (state.tab === "current") renderCurrent();
  if (state.tab === "images") renderImages();
  if (state.tab === "mockups") renderMockups();
  if (state.tab === "runs") renderRuns();
  if (state.tab === "documents") renderDocuments();
}

function renderCurrent() {
  const data = state.sessionData;
  if (data.statusKind !== "valid" || !data.status) {
    const reason = data.statusKind === "missing" ? "status.json 없음" : `status.json을 읽을 수 없음: ${esc(data.statusError)}`;
    const sourceMessage = data.hasSession ? "이 세션의 현재 단계는 session.md에만 기록되어 있습니다." : "session.md가 없어 현재 단계를 표시할 수 없습니다.";
    const excerptText = data.sessionExcerpt
      ? renderExcerpt(data.sessionExcerpt)
      : `<p>${esc(data.sessionReadError || (data.hasSession ? "session.md에 표시할 H2 섹션이 없습니다." : "session.md가 없습니다."))}</p>`;
    const sessionLink = data.hasSession ? `<a class="legacy-excerpt-link" href="${esc(routeFor(state.session, "documents", "session.md"))}" data-journal-route="${esc(routeFor(state.session, "documents", "session.md"))}">session.md 전체 보기 →</a>` : "";
    const finalLink = data.hasFinalSummary ? `<div class="legacy-final-line">final_summary.md 있음 → <a href="${esc(routeFor(state.session, "documents", "final_summary.md"))}" data-journal-route="${esc(routeFor(state.session, "documents", "final_summary.md"))}">문서 탭에서 열기</a></div>` : "";
    panel.innerHTML = `<div class="legacy-notice"><p><strong>${reason} — ${sourceMessage}</strong></p><p>단계나 대기 상태를 추정하지 않습니다.</p></div><h2 class="legacy-section-heading">session.md 마지막 섹션 (자동 추출)</h2><article class="legacy-excerpt">${excerptText}${sessionLink}</article>${finalLink}`;
    return;
  }
  const status = data.status;
  const waiting = status.waitingOn === "user";
  const active = status.waitingOn === "agent";
  const label = waiting ? "사용자 응답 대기" : active ? "에이전트 작업 중" : "대기 없음";
  const className = waiting ? "waiting" : active ? "active" : "";
  const updated = new Date(status.updatedAt);
  const age = Number.isFinite(updated.getTime()) ? relative(status.updatedAt) : "시각 미상";
  const updatedLabel = statusUpdateText(status.updatedAt);
  const step = status.stage;
  const stepText = `Step ${step}${step === 7 && status.waitingOn === "none" ? " · 종료" : ` / 7 · ${STEP_LABELS[step - 1]}`}`;
  const bar = `<span class="step-progress" role="progressbar" aria-label="진행 단계" aria-valuemin="1" aria-valuemax="7" aria-valuenow="${step}" aria-valuetext="Step ${step} / 7 · ${esc(STEP_LABELS[step - 1])}">${STEP_LABELS.map((_, index) => `<span class="${index < step ? "done" : ""}" aria-hidden="true"></span>`).join("")}</span>`;
  const decision = status.userDecision ? `<div class="decision-card"><div class="decision-heading">결정 필요 · 대화에서 답변</div><p class="decision-question">${esc(status.userDecision.question)}</p>${status.userDecision.options.map((option, index) => `<div class="decision-option"><span class="option-mark">${String.fromCharCode(65 + index)}</span><span>${esc(option)}</span></div>`).join("")}</div>` : "";
  const next = status.nextAction ? `<p class="status-next"><strong>다음:</strong> ${esc(status.nextAction)}</p>` : "";
  panel.innerHTML = `<section class="status-panel panel ${className}" aria-label="${label}"><div class="status-topline"><h2 class="status-title">${label}</h2><time class="status-updated" datetime="${esc(updatedLabel.datetime)}" title="${esc(updated.toLocaleString())}">갱신 <span class="status-clock">${esc(updatedLabel.clock)}</span> <span class="status-age">(${esc(age)})</span></time></div><div class="step-line"><span>${stepText}</span>${bar}</div><p class="status-summary">${esc(status.summary)}</p>${next}${decision}</section>${focusSection(data)}${runsSection(data)}${recentSection(data)}`;
}

function renderExcerpt(section) {
  const lines = section.split("\n");
  const title = lines[0]?.replace(/^##\s+/, "") ?? "session.md";
  const body = [];
  let list = null;
  let previousItem = null;
  const flush = () => {
    if (!list) return;
    const renderItems = (items) => items.map((item) => `<li>${esc(item.text)}${item.children.length ? `<${item.children[0].type} class="legacy-excerpt-list">${renderItems(item.children[0].items)}</${item.children[0].type}>` : ""}</li>`).join("");
    body.push(`<${list.type} class="legacy-excerpt-list">${renderItems(list.items)}</${list.type}>`);
    list = null;
    previousItem = null;
  };
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const match = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (!match) {
      flush();
      body.push(`<p>${esc(line)}</p>`);
      continue;
    }
    const type = /^\d/.test(match[2]) ? "ol" : "ul";
    if (match[1].length >= 2 && previousItem) {
      const childList = previousItem.children[0];
      if (childList && childList.type === type) childList.items.push({ text: match[3], children: [] });
      else previousItem.children = [{ type, items: [{ text: match[3], children: [] }] }];
      continue;
    }
    if (!list || list.type !== type) {
      flush();
      list = { type, items: [] };
    }
    const item = { text: match[3], children: [] };
    list.items.push(item);
    previousItem = item;
  }
  flush();
  return `<h2>${esc(title)}</h2>${body.join("")}`;
}
function focusSection(data) {
  const focuses = data.focus ?? [];
  const cards = focuses.map((focus) => {
    const file = focus.resolvedPath;
    if (!file) return `<div class="focus-card"><div class="focus-body"><span class="focus-title">경로를 해석할 수 없음</span><code>${esc(focus.path)}</code></div></div>`;
    const html = /\.html?$/i.test(file);
    const image = /\.(?:jpe?g|png)$/i.test(file);
    const folder = data.folders.find((item) => item.path === file);
    const document = !html && !image && !folder;
    const folderImages = folder?.groups.flatMap((group) => group.images).slice(0, 6) ?? [];
    const preview = html ? `<iframe title="${esc(pathBase(file))} 미리보기" sandbox="allow-scripts" src="${esc(mediaUrl(state.session, file))}"></iframe>` : image ? `<img loading="lazy" src="${esc(mediaUrl(state.session, file))}" alt="${esc(file)}">` : folder ? `<div class="image-strip">${folderImages.map((item) => focusImageTile(item)).join("")}</div>` : "";
    const action = html ? `<span class="focus-action">목업 탭에서 열기 →</span>` : folder ? `<span class="focus-action">모두 보기 (${folder.count}) →</span>` : image ? `<span class="focus-action">이미지 탭에서 열기 →</span>` : `<span class="focus-action">문서 탭에서 열기 →</span>`;
    const routeTab = html ? "mockups" : image || folder ? "images" : "documents";
    const routeTarget = html || !image && !folder ? file : folder?.path ?? "";
    const cardClass = html ? "is-html" : folder ? "is-folder" : document ? "is-document" : "is-image";
    const summary = document ? focus.preview || focus.note : focus.note;
    const content = document
      ? `${summary ? `<span class="focus-document-summary">${esc(summary)}</span>` : ""}${focus.preview && focus.note && focus.preview !== focus.note ? `<span class="focus-note">${esc(focus.note)}</span>` : ""}`
      : `${summary ? `<span class="focus-note">${esc(summary)}</span>` : ""}`;
    const body = `<span class="focus-body"><span class="focus-title file-path">${esc(file)}</span>${content}${folder ? preview : ""}${action}</span>`;
    return `<a class="focus-card ${cardClass}" href="${esc(routeFor(state.session, routeTab, routeTarget))}" data-journal-route="${esc(routeFor(state.session, routeTab, routeTarget))}">${folder || document ? "" : `<span class="focus-preview">${preview}</span>`}${body}</a>`;
  }).join("");
  return `<section class="content-section"><h2 class="section-heading">${data.status?.focus?.length ? "지금 볼 것" : "최근 산출물 (자동)"}</h2><div class="focus-grid">${cards || '<div class="panel empty-inline">표시할 산출물이 없습니다.</div>'}</div></section>`;
}
function runsSection(data) {
  const active = data.runs.filter((run) => run.active && run.state.kind === "running");
  return `<section class="content-section"><h2 class="section-heading">실행 중</h2><div class="run-list">${active.length ? active.map((run) => `<button class="run-row" type="button" data-tab="runs" data-run="${esc(run.dir)}"><span class="run-status"><i class="run-dot" aria-hidden="true"></i>실행 중 ${Math.floor((run.elapsedSeconds ?? 0) / 60)}분째</span><code class="run-path">${esc(run.dir)}</code><span class="run-labels"><span>${esc(run.agent)}</span><span>${esc(run.model || run.role)}</span><span class="run-label-pair"><span>마지막 활동</span><span>${esc(relative(run.lastActivity))}</span></span><span>이미지 ${run.imageCount}</span></span></button>`).join("") : '<div class="panel empty-inline">현재 실행 중인 run이 없습니다.</div>'}</div></section>`;
}
function focusImageTile(image) {
  const dimensions = image.dimensions;
  const width = dimensions?.width && dimensions?.height ? Math.max(28, Math.min(96, Math.round(40 * dimensions.width / dimensions.height))) : 58;
  return `<span class="focus-thumb" style="width:${width}px"><img loading="lazy" src="${esc(mediaUrl(state.session, image.path))}" alt=""><span class="focus-thumb-caption">${esc(pathBase(image.path))}</span></span>`;
}
function recentSection(data) {
  return `<section class="content-section"><h2 class="section-heading">최근 변경</h2><div class="history-list">${data.recentChanges.slice(0, 15).map((item) => {
    const date = new Date(item.mtime);
    const clock = shortDateTime(date) ?? "시각 없음";
    const verb = item.kind === "image" ? "추가" : item.kind === "status" ? "갱신" : "변경";
    return `<div class="history-row"><time class="history-time" datetime="${Number.isFinite(date.getTime()) ? esc(date.toISOString()) : ""}">${clock}</time><span class="history-item">${item.kind === "image" ? `<button class="history-thumb" type="button" data-image-path="${esc(item.path)}" aria-label="${esc(item.path)} 이미지 열기"><img src="${esc(mediaUrl(state.session, item.path))}" alt=""></button>` : ""}<code class="history-path" title="${esc(item.path)}">${esc(item.path)}</code><span class="history-verb">${verb}</span></span></div>`;
  }).join("")}</div></section>`;
}
function pathBase(value) { return value.split("/").at(-1) ?? value; }
function folderSelected() { return state.sessionData.folders.find((folder) => folder.path === state.selectedFolder) ?? state.sessionData.folders[0] ?? null; }
function allImages(data = state.sessionData, session = state.session) { return data.folders.flatMap((folder) => folder.groups.flatMap((group) => group.images.map((image) => ({ ...image, session, folder: folder.path, group: { ...group, images: undefined } })))); }
function imagesInBrief(data, session, briefPath = "") {
  const byPath = new Map(allImages(data, session).map((image) => [image.path, image]));
  return data.briefImages.filter((image) => !briefPath || image.brief === briefPath).flatMap((image) => {
    const found = byPath.get(image.path);
    return found ? [{ ...found, briefRef: true }] : [];
  });
}
function imageButton(image, session = state.session) {
  const dimensions = image.dimensions ? `${image.dimensions.width}×${image.dimensions.height}` : "크기 미상";
  const prefix = pathBase(image.path).match(/^(\d{3})-(.*?)(?:\.(?:jpe?g|png))$/i);
  const caption = prefix ? `${prefix[1]} · ${prefix[2]}` : pathBase(image.path);
  const accessibleName = `${caption} · ${dimensions}`;
  return `<button class="thumb-button" type="button" data-image-path="${esc(image.path)}" data-image-session="${esc(session)}" aria-label="${esc(accessibleName)}">${image.briefRef ? '<span class="brief-tag">브리프 참조</span>' : ""}<img loading="lazy" src="${esc(mediaUrl(session, image.path))}" alt=""><span class="thumb-caption"><span class="thumb-name" title="${esc(pathBase(image.path))}">${esc(caption)}</span><span class="thumb-dimensions">${esc(dimensions)}</span></span></button>`;
}
function folderOptions() {
  const briefLabel = state.sessionData.briefImages.length
    ? `브리프에 연결된 이미지 (${state.sessionData.briefImages.length})`
    : "브리프에 연결된 이미지 없음";
  return `<option value="${BRIEF_GALLERY_TARGET}" ${state.galleryTarget === BRIEF_GALLERY_TARGET ? "selected" : ""}>${briefLabel}</option>${state.sessionData.folders.map((folder) => `<option value="${esc(folder.path)}" ${folder.path === state.galleryTarget ? "selected" : ""}>${esc(folder.path)} · ${folder.count}</option>`).join("")}`;
}
function renderImages({ incremental = false } = {}) {
  const data = state.sessionData;
  const folder = folderSelected();
  const scrollY = window.scrollY;
  const briefGroups = new Map();
  for (const image of data.briefImages) {
    if (!briefGroups.has(image.brief)) briefGroups.set(image.brief, []);
    briefGroups.get(image.brief).push(image);
  }
  const briefSignature = JSON.stringify(data.briefImages.map((image) => [image.path, image.brief]));
  const brief = `<section class="brief-gallery" id="brief-gallery" data-signature="${esc(briefSignature)}"><h2>브리프에 연결된 이미지 (${data.briefImages.length})</h2>${data.briefImages.length ? [...briefGroups].map(([briefPath, images]) => `<section class="brief-file-group"><h3 class="file-path">${esc(briefPath)}</h3><div class="thumb-grid">${images.map((image) => imageButton({ ...image, briefRef: true }, state.session)).join("")}</div></section>`).join("") : '<div class="empty-inline">브리프에 연결된 이미지 없음</div>'}</section>`;
  if (!incremental) panel.innerHTML = `<div class="gallery-layout"><aside class="folder-list" id="folder-list"></aside><section class="gallery-content"><label class="sr-only" for="folder-select">이미지 폴더</label><select id="folder-select" class="folder-select">${folderOptions()}</select>${brief}<div id="gallery-folders"></div></section></div>`;
  else {
    const select = $("#folder-select");
    if (select) select.innerHTML = folderOptions();
    const existingBrief = $("#brief-gallery");
    if (existingBrief && existingBrief.dataset.signature !== briefSignature) existingBrief.outerHTML = brief;
  }
  renderFolderRail();
  const gallery = $("#gallery-folders");
  if (gallery) {
    reconcileByKey(gallery, data.folders, (item) => item.path, (item) => createFolderNode(item), (item) => item.path);
    for (const item of data.folders) {
      const node = [...gallery.children].find((element) => element.dataset.key === item.path);
      if (node) updateFolderNode(node, item);
    }
    if (incremental) window.scrollTo(0, scrollY);
  }
  if (folder && !incremental) {
    const selectedButton = $(`[data-folder="${cssEscape(folder.path)}"]`, $("#folder-list"));
    selectedButton?.scrollIntoView({ block: "nearest" });
  }
  if (!incremental && state.target === BRIEF_GALLERY_TARGET) {
    requestAnimationFrame(() => $("#brief-gallery")?.scrollIntoView({ block: "start" }));
  } else if (!incremental && data.folders.some((item) => item.path === state.target)) {
    requestAnimationFrame(() => [...$("#gallery-folders").children].find((node) => node.dataset.key === state.target)?.scrollIntoView({ block: "start" }));
  }
}
function renderFolderRail() {
  const rail = $("#folder-list");
  if (!rail) return;
  const briefGroups = new Map();
  for (const image of state.sessionData.briefImages) {
    if (!briefGroups.has(image.brief)) briefGroups.set(image.brief, []);
    briefGroups.set(image.brief, [...briefGroups.get(image.brief), image]);
  }
  const briefLines = [...briefGroups].map(([briefPath, images]) => `<span class="brief-choice-file">${esc(briefPath)} · ${images.length}</span>`).join("");
  const briefChoice = state.sessionData.briefImages.length
    ? `<button type="button" class="brief-choice" data-brief-gallery aria-current="${state.galleryTarget === BRIEF_GALLERY_TARGET}"><span class="brief-choice-title">브리프에 연결된 이미지 <span class="mono">${state.sessionData.briefImages.length}</span></span><span class="brief-choice-files">${briefLines}</span></button>`
    : `<button type="button" class="brief-choice is-empty" data-brief-gallery aria-current="${state.galleryTarget === BRIEF_GALLERY_TARGET}"><span class="brief-choice-title">브리프에 연결된 이미지 없음</span></button>`;
  rail.innerHTML = `${briefChoice}<div class="folder-list-separator" aria-hidden="true"></div>${state.sessionData.folders.map((folder) => `<button type="button" class="folder-choice" data-folder="${esc(folder.path)}" aria-current="${folder.path === state.galleryTarget}"><span class="file-path">${esc(folder.path)}</span><span class="caption">${folder.count}장 · ${folder.newestAt ? esc(relative(folder.newestAt)) : "시각 없음"}</span></button>`).join("")}`;
  if (state.galleryTarget === BRIEF_GALLERY_TARGET) rail.querySelector("[data-brief-gallery]")?.scrollIntoView({ block: "nearest" });
  else rail.querySelector(`[data-folder="${cssEscape(state.galleryTarget)}"]`)?.scrollIntoView({ block: "nearest" });
}
function jumpToGalleryTarget(target) {
  if (target !== BRIEF_GALLERY_TARGET && !state.sessionData.folders.some((folder) => folder.path === target)) return;
  state.galleryTarget = target;
  if (target !== BRIEF_GALLERY_TARGET) state.selectedFolder = target;
  state.target = target;
  const route = routeFor(state.session, "images", target);
  if (location.hash !== route) location.hash = route;
  renderFolderRail();
  const select = $("#folder-select");
  if (select) select.value = target;
  requestAnimationFrame(() => {
    if (target === BRIEF_GALLERY_TARGET) $("#brief-gallery")?.scrollIntoView({ block: "start" });
    else [...$("#gallery-folders").children].find((node) => node.dataset.key === target)?.scrollIntoView({ block: "start" });
  });
}
function createFolderNode(folder) {
  const node = document.createElement("section");
  node.className = "gallery-folder";
  node.dataset.key = folder.path;
  node.innerHTML = `<h2 class="section-heading gallery-folder-heading"></h2><div class="gallery-groups"></div>`;
  updateFolderNode(node, folder);
  return node;
}
function updateFolderNode(node, folder) {
  const requestFiles = [...new Set(folder.groups.map((group) => group.requestFile).filter(Boolean))];
  const requestFile = requestFiles[0];
  const requestFolder = requestFile?.split("/").slice(0, -1).join("/");
  const runLink = requestFolder ? ` · 실행: <a href="${esc(routeFor(state.session, "runs", requestFolder))}" data-journal-route="${esc(routeFor(state.session, "runs", requestFolder))}">${esc(pathBase(requestFolder))} →</a>` : "";
  const requestSummary = requestFile ? ` · ${esc(pathBase(requestFile))} 기준 조건 ${folder.groups.filter((group) => group.requestFile).length}개${runLink}` : "";
  $(".gallery-folder-heading", node).innerHTML = `<span class="folder-path">${esc(folder.path)}</span><span class="gallery-folder-meta">${folder.count}장${requestSummary}</span>`;
  const groups = $(".gallery-groups", node);
  reconcileByKey(groups, folder.groups, (group) => group.id, (group) => createConditionNode(group, folder.path), (group) => JSON.stringify(group));
}
function createConditionNode(group, folderPath) {
  const node = document.createElement("section");
  node.className = "condition-group";
  node.dataset.key = group.id;
  node.innerHTML = `<h3 class="condition-heading"><span class="condition-id${group.title === "조건 정보 없음" ? " is-no-condition" : ""}"></span><span class="condition-expected"></span></h3><div class="audit-line"></div><div class="thumb-grid"></div>`;
  node.querySelector(".condition-id").textContent = group.title;
  if (group.expected) node.querySelector(".condition-expected").textContent = group.expected;
  const audit = node.querySelector(".audit-line");
  if (group.audit) {
    for (const part of group.audit.split(" · ")) {
      const span = document.createElement("span");
      span.className = `audit-part ${part.startsWith("axe ") && part !== "axe 0" ? "axe-tag" : ""}`;
      span.textContent = part;
      audit.append(span);
    }
  }
  const grid = node.querySelector(".thumb-grid");
  for (const image of group.images) grid.insertAdjacentHTML("beforeend", imageButton(image));
  return node;
}
function reconcileByKey(container, items, keyOf, create, signatureOf) {
  const current = new Map([...container.children].map((element) => [element.dataset.key, element]));
  const wanted = new Set();
  let cursor = container.firstElementChild;
  for (const item of items) {
    const key = keyOf(item);
    wanted.add(key);
    let element = current.get(key);
    const signature = signatureOf(item);
    if (!element || element.dataset.signature !== signature) {
      const replacement = create(item);
      replacement.dataset.key = key;
      replacement.dataset.signature = signature;
      if (element) {
        const replacingCursor = element === cursor;
        element.replaceWith(replacement);
        if (replacingCursor) cursor = replacement;
      }
      element = replacement;
    }
    if (element !== cursor) container.insertBefore(element, cursor);
    cursor = element.nextElementSibling;
  }
  for (const [key, element] of current) if (!wanted.has(key)) element.remove();
}
function cssEscape(value) { return window.CSS?.escape ? CSS.escape(value) : value.replaceAll('"', '\\"'); }

function renderMockups() {
  const data = state.sessionData;
  const list = `<aside class="mockup-list">${data.mockups.map((item) => `<button class="mockup-choice" type="button" data-mockup="${esc(item.path)}" aria-current="${state.selectedMockup === item.path}"><span class="file-path">${esc(item.path)}</span><span class="caption">${timeElement(item.mtime)} · ${formatSize(item.size)}</span></button>`).join("")}</aside>`;
  if (!data.mockups.length) { panel.innerHTML = '<div class="empty-state">HTML 목업이 없습니다.</div>'; return; }
  if (!state.selectedMockup || !data.mockups.some((item) => item.path === state.selectedMockup)) state.selectedMockup = data.mockups[0].path;
  const selected = data.mockups.find((item) => item.path === state.selectedMockup);
  const widths = [...new Set(selected.presets)].sort((a, b) => a - b);
  const activeWidth = state.mockupWidth ?? widths[0] ?? "fit";
  const src = mediaUrl(state.session, selected.path);
  const refresh = state.mockupUpdated ? `<span class="mockup-refresh">갱신됨 ${timeElement(state.mockupUpdated)}</span>` : "";
  panel.innerHTML = `<div class="mockup-layout">${list}<section class="mockup-viewer"><div class="mockup-toolbar"><div class="segments" role="group" aria-label="목업 폭">${widths.map((width) => `<button type="button" data-width="${width}" aria-pressed="${activeWidth === width}">${width}</button>`).join("")}<button type="button" data-width="fit" aria-pressed="${activeWidth === "fit"}">맞춤</button></div><label class="caption">${widths.length ? "프리셋: 캡처 실행의 뷰포트" : "캡처된 뷰포트 없음"}</label><span id="mockup-scale" class="caption">100%</span><button type="button" data-open-mockup="${esc(selected.path)}">새 탭에서 열기</button><button type="button" data-copy-value="${esc(selected.path)}">경로 복사</button>${refresh}</div><div id="mockup-stage" class="mockup-stage"><div class="device-wrap"><div class="device-frame" id="device-frame"><iframe id="mockup-frame" title="${esc(pathBase(selected.path))} 미리보기" sandbox="allow-scripts" src="${esc(src)}"></iframe></div><span class="frame-width" id="frame-width"></span></div></div><div class="run-links">이 목업을 캡처한 실행: ${selected.captures.length ? selected.captures.map((run) => `<a href="${esc(routeFor(state.session, "runs", run))}" data-journal-route="${esc(routeFor(state.session, "runs", run))}">${esc(run)}</a>`).join(" · ") : "없음"}</div></section></div>`;
  const frame = $("#device-frame");
  const iframe = $("#mockup-frame");
  const stage = $("#mockup-stage");
  const targetWidth = activeWidth === "fit" ? Math.max(240, stage.clientWidth - 36) : Number(activeWidth);
  const stageAvailable = Math.max(240, stage.clientWidth - 36);
  const displayedWidth = Math.min(targetWidth, stageAvailable);
  const scale = displayedWidth / targetWidth;
  const previewHeight = Math.max(360, Math.min(window.innerHeight - 280, 900));
  frame.style.width = `${displayedWidth}px`;
  frame.style.height = `${Math.round(previewHeight * scale)}px`;
  iframe.style.width = `${targetWidth}px`;
  iframe.style.height = `${previewHeight}px`;
  iframe.style.transform = `scale(${scale})`;
  iframe.style.marginRight = `${targetWidth * (scale - 1)}px`;
  iframe.style.marginBottom = `${previewHeight * (scale - 1)}px`;
  const scaleLabel = scale < .995 ? ` · 축소 ${Math.round(scale * 100)}%` : "";
  $("#frame-width").textContent = `${targetWidth} px${scaleLabel}`;
  $("#mockup-scale").textContent = scale < .995 ? `축소 ${Math.round(scale * 100)}%` : "100%";
}
function formatSize(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

function renderRuns() {
  if (!state.sessionData.runs.length) { panel.innerHTML = '<div class="empty-state">실행 기록이 없습니다.</div>'; return; }
  const rows = state.sessionData.runs.map((run) => `<tr class="${state.target === run.dir ? "is-selected" : ""}"><td>${timeElement(run.startedAt)}</td><td><button type="button" data-run="${esc(run.dir)}" aria-current="${state.target === run.dir ? "location" : "false"}">${esc(run.dir)}</button></td><td>${esc(run.model || "모델 기록 없음")}</td><td class="${run.state.kind === "failure" ? "run-state-failure" : run.state.kind === "running" ? "run-status" : ""}">${esc(run.state.kind === "running" ? `실행 중 ${Math.floor((run.elapsedSeconds ?? 0) / 60)}분째` : run.state.label)}</td><td>${run.elapsedSeconds === null ? "—" : `${Math.floor(run.elapsedSeconds / 60)}분`}</td><td>${run.imageCount}</td></tr>`).join("");
  panel.innerHTML = `<div class="table-scroll run-table"><table><thead><tr><th>시작</th><th>실행</th><th>모델</th><th>상태</th><th>소요</th><th>이미지</th></tr></thead><tbody>${rows}</tbody></table></div><div id="run-detail"></div>`;
  if (state.target) { state.selectedRun = state.target; renderRunDetail(state.target); }
}
async function renderRunDetail(runDir) {
  const host = $("#run-detail");
  if (!host) return;
  const session = state.session;
  try {
    const details = await getJson("/api/run", { session, path: runDir });
    if (!host.isConnected || session !== state.session || runDir !== state.selectedRun) return;
    const run = details.run;
    const result = details.result === null ? `<p class="muted">${esc(details.resultError === "result.md is missing" ? "result.md 없음" : `result.md를 읽을 수 없음: ${details.resultError}`)}</p>` : details.result.trim() ? details.resultHtml : '<p class="muted">result.md가 비어 있습니다.</p>';
    const prompt = details.prompt === null ? esc(details.promptError === "prompt.md is missing" ? "prompt.md 없음" : `prompt.md를 읽을 수 없음: ${details.promptError}`) : details.prompt;
    const stderr = details.stderr === null ? esc(details.stderrError === "stderr.log is missing" ? "stderr.log 없음" : `stderr.log를 읽을 수 없음: ${details.stderrError}`) : details.stderr;
    const failureOpen = run.exitCode !== null && run.exitCode !== 0 ? " open" : "";
    const imageGroups = details.imageGroups.length ? details.imageGroups.map((group) => `<section class="condition-group"><h3 class="condition-heading"><span class="condition-id">${esc(group.title)}</span>${group.expected ? `<span class="condition-expected">${esc(group.expected)}</span>` : ""}</h3>${group.audit ? `<div class="audit-line">${esc(group.audit)}</div>` : ""}<div class="thumb-grid">${group.images.map((image) => imageButton(image)).join("")}</div></section>`).join("") : '<p class="muted">이미지가 없습니다.</p>';
    const statusClass = run.exitCode !== null && run.exitCode !== 0 ? "run-state-failure" : "";
    host.innerHTML = `<section class="run-detail"><h2 class="run-path-heading">${esc(runDir)}</h2><div class="run-detail-section"><h2>상태</h2><div>${esc(run.runId ? `session-id/thread-id: ${run.runId} · ` : "")}${esc(run.model || "모델 기록 없음")}</div><div class="caption ${statusClass}">${esc(run.state.label)}</div></div><div class="run-detail-section"><h2>결과</h2><article class="markdown-content">${result}</article></div><div class="run-detail-section"><h2>조건</h2>${details.conditions.length ? `<div class="table-scroll"><table class="condition-table"><thead><tr><th>조건 ID</th><th>기대 결과</th></tr></thead><tbody>${details.conditions.map((condition) => `<tr><td><code>${esc(condition.id)}</code></td><td>${esc(condition.expected)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">조건 정보 없음</p>'}</div><div class="run-detail-section"><h2>조건별 이미지</h2>${imageGroups}</div><details class="run-detail-section"><summary>프롬프트</summary><pre tabindex="0" aria-label="실행 프롬프트">${esc(prompt)}</pre></details><details class="run-detail-section"${failureOpen}><summary>stderr.log</summary><pre class="${run.exitCode !== null && run.exitCode !== 0 ? "stderr-failure" : ""}" tabindex="0" aria-label="실행 오류 기록">${esc(stderr.split("\n").slice(-50).join("\n"))}</pre></details><div class="run-detail-section dimmed"><h2>사용량</h2><div class="usage-body">${esc(details.usage)}</div></div></section>`;
  } catch (error) {
    if (host.isConnected && session === state.session && runDir === state.selectedRun) host.innerHTML = `<p class="empty-inline">실행 상세를 읽을 수 없습니다: ${esc(error.message)}</p>`;
  }
}

function renderDocumentsList() {
  const data = state.sessionData.documents;
  const rows = data.primary.map((doc) => ({ ...doc, group: "" }));
  for (const group of data.groups) {
    const title = group.folder === "." ? "저널 루트" : group.folder;
    rows.push({ groupStart: title });
    rows.push(...group.docs.map((doc) => ({ ...doc, group: "" })));
  }
  const selected = state.selectedDocument || rows[0]?.path;
  const list = `<aside class="document-list">${rows.map((doc) => doc.groupStart
    ? `<div class="document-group-title">${esc(doc.groupStart)}</div>`
    : `<button class="document-choice" type="button" data-document="${esc(doc.path)}" aria-current="${selected === doc.path}"><span class="file-path">${esc(doc.title)}</span><span class="caption">${timeElement(doc.mtime)}</span></button>`).join("")}</aside>`;
  const layout = $("#document-layout");
  if (layout) {
    const existingList = $(".document-list", layout);
    if (existingList) existingList.outerHTML = list;
    else layout.insertAdjacentHTML("afterbegin", list);
  }
  else panel.innerHTML = `<div id="document-layout" class="document-layout">${list}<section id="document-view" class="document-view"></section></div>`;
  state.selectedDocument = selected ?? "";
  return selected;
}
async function renderDocuments() {
  if (state.target) state.selectedDocument = state.target;
  const selected = renderDocumentsList();
  if (!selected) { $("#document-view").innerHTML = '<div class="empty-inline">문서가 없습니다.</div>'; return; }
  await loadDocument(state.selectedDocument);
}
async function loadDocument(file) {
  const loadId = ++documentLoadId;
  state.selectedDocument = file;
  state.documentChanged = false;
  state.documentText = null;
  const view = $("#document-view");
  if (!view) return;
  const session = state.session;
  view.innerHTML = '<p class="muted">문서를 불러오고 있습니다.</p>';
  try {
    const doc = await getJson("/api/file-text", { session, path: file });
    if (!view.isConnected || session !== state.session || file !== state.selectedDocument || loadId !== documentLoadId) return;
    state.documentText = doc;
    const isMarkdown = /\.md$/i.test(file);
    const headings = isMarkdown ? doc.headings.filter((item) => item.id) : [];
    const toc = headings.length >= 3 ? `<nav class="markdown-toc" aria-label="문서 목차"><h2>목차</h2><ol>${headings.map((item) => `<li><a href="#${esc(item.id)}">${esc(item.title)}</a></li>`).join("")}</ol></nav>` : "";
    const content = isMarkdown ? `<article class="markdown-content">${doc.html}</article>` : `<pre tabindex="0" aria-label="문서 원문">${esc(doc.text)}</pre>`;
    view.innerHTML = `<div class="document-toolbar"><code>${esc(file)}</code><button type="button" data-raw-toggle="false">원문</button></div>${toc}${content}`;
    if (state.documentChanged) markDocumentChanged();
    if (file === "session.md") {
      const lastH2 = view.querySelectorAll("h2").item(view.querySelectorAll("h2").length - 1);
      lastH2?.scrollIntoView({ block: "start" });
    }
  } catch (error) {
    if (view.isConnected && session === state.session && file === state.selectedDocument && loadId === documentLoadId) view.innerHTML = `<p class="empty-inline">문서를 읽을 수 없습니다: ${esc(error.message)}</p>`;
  }
}
function markDocumentChanged() {
  state.documentChanged = true;
  const view = $("#document-view");
  if (!view || $(".changed-bar", view)) return;
  const bar = document.createElement("div");
  bar.className = "changed-bar";
  bar.innerHTML = `<span>파일이 변경됨 · 다시 불러오기</span><button type="button" data-reload-document>다시 불러오기</button>`;
  view.prepend(bar);
}

function decorateImage(session, imagePath) {
  const foundSession = session === state.session ? state.sessionData : null;
  const image = foundSession?.folders.flatMap((folder) => folder.groups.flatMap((group) => group.images.map((item) => ({ ...item, folder: folder.path, group: { ...group, images: undefined } })))).find((item) => item.path === imagePath);
  if (image) return { ...image, session };
  return { path: imagePath, session, dimensions: null, group: null, folder: "", url: mediaUrl(session, imagePath) };
}
function imagesInFolder(data, folderPath, session) {
  const folder = data?.folders.find((item) => item.path === folderPath);
  return folder?.groups.flatMap((group) => group.images.map((image) => ({ ...image, session, folder: folder.path, group: { ...group, images: undefined } }))) ?? [];
}
function openLightbox(image, images, opener, sessionData = state.sessionData, scope = "folder", briefPath = "") {
  const folder = sessionData?.folders.find((item) => item.path === image.folder || item.groups.some((group) => group.images.some((candidate) => candidate.path === image.path)));
  const scopedImages = scope === "brief" ? images : folder ? imagesInFolder(sessionData, folder.path, image.session ?? state.session) : images;
  state.currentImageSet = scopedImages.length ? scopedImages : [image];
  state.pinnedImage = null;
  state.lightboxSession = image.session ?? state.session;
  state.lightboxData = sessionData;
  state.lightboxScope = scope;
  state.lightboxFolder = folder?.path ?? image.folder ?? "";
  state.lightboxBriefPath = scope === "brief" ? briefPath : "";
  state.imageIndex = Math.max(0, state.currentImageSet.findIndex((item) => item.path === image.path && item.session === image.session));
  state.opener = opener ?? document.activeElement;
  state.openerMeta = { session: image.session ?? state.session, path: image.path };
  state.naturalSize = false;
  state.infoOpen = window.matchMedia("(min-width: 1200px)").matches;
  renderLightbox();
  if (!lightbox.open) lightbox.showModal();
  $(".lightbox-top button", lightbox)?.focus({ preventScroll: true });
}
function currentImage() { return state.currentImageSet[state.imageIndex] ?? null; }
function renderLightbox() {
  const image = currentImage();
  if (!image) return;
  const activeControl = lightbox.contains(document.activeElement) ? document.activeElement.dataset.lightboxControl || "close" : "";
  const originalFrame = $(".lightbox-image-frame.is-original", lightbox);
  const originalFramePosition = originalFrame ? { path: originalFrame.dataset.lightboxFramePath, scrollTop: originalFrame.scrollTop, scrollLeft: originalFrame.scrollLeft } : null;
  const current = { ...image, session: image.session ?? state.session };
  const pinned = state.pinnedImage;
  const compare = pinned && (pinned.path !== current.path || pinned.session !== current.session);
  const lightboxFolders = state.lightboxData?.folders ?? [];
  const folderOptions = lightboxFolders.map((folder) => `<option value="${esc(folder.path)}" ${folder.path === current.folder ? "selected" : ""}>${esc(folder.path)}</option>`).join("");
  const details = current.group ?? {};
  const imageViewport = resolveImageViewport(current.path, details.viewports);
  const imageViewportLabel = imageViewport ? `${imageViewport.name} · ${imageViewport.width}×${imageViewport.height ?? "?"}` : "알 수 없음";
  const requestedViewports = details.viewports?.map((viewport) => `${viewport.name} · ${viewport.width}×${viewport.height ?? "?"}`).join(", ") || "요청 기록 없음";
  const imageSizeAttrs = (item) => item.dimensions?.width > 0 && item.dimensions?.height > 0 ? ` width="${item.dimensions.width}" height="${item.dimensions.height}"` : "";
  lightbox.classList.toggle("show-info", state.infoOpen);
  lightbox.innerHTML = `<header class="lightbox-top"><div class="lightbox-top-row lightbox-path-row"><span class="lightbox-path" title="${esc(current.path)}">${esc(current.path)}</span></div><div class="lightbox-top-row lightbox-meta-row"><span class="lightbox-counter">${state.imageIndex + 1} / ${state.currentImageSet.length}</span><select data-lightbox-control="folder" data-lightbox-folder aria-label="이미지 폴더">${folderOptions}</select></div><div class="lightbox-top-row lightbox-actions-row"><button type="button" data-lightbox-control="pin" data-pin-image>${pinned ? "고정 해제 (P)" : "고정 (P)"}</button><a class="lightbox-top-button" data-lightbox-control="original" href="${esc(mediaUrl(current.session, current.path))}" target="_blank" rel="noopener">원본 새 탭</a><button type="button" data-lightbox-control="info" data-lightbox-info>정보 (i)</button><button type="button" data-lightbox-control="close" data-lightbox-close>닫기 (Esc)</button></div></header><div class="lightbox-body"><div class="lightbox-stage${compare ? " is-compare" : ""}"><button class="lightbox-nav prev" type="button" data-lightbox-control="previous" data-lightbox-prev aria-label="이전 이미지">‹</button><div class="lightbox-images">${compare ? `<section class="lightbox-image-pane"><span class="lightbox-pane-title" title="${esc(pinned.path)}"><strong>고정:</strong><span>${esc(pinned.path)}</span></span><div class="lightbox-image-frame"><img src="${esc(mediaUrl(pinned.session, pinned.path))}"${imageSizeAttrs(pinned)} alt="고정 비교 이미지"></div></section>` : ""}<section class="lightbox-image-pane"><span class="lightbox-pane-title" title="${esc(current.path)}"><strong>현재:</strong><span>${esc(current.path)}</span></span><div class="lightbox-image-frame${state.naturalSize ? " is-original" : ""}"${state.naturalSize ? ` data-lightbox-control="frame" data-lightbox-frame-path="${esc(current.path)}" tabindex="0" aria-label="원본 크기 이미지 스크롤 영역: ${esc(current.path)}"` : ""}><img class="${state.naturalSize ? "is-original" : ""}" src="${esc(mediaUrl(current.session, current.path))}"${imageSizeAttrs(current)} alt="${esc(details.title ? `${details.title} ${details.expected ?? ""}` : current.path)}"></div></section></div><button class="lightbox-nav next" type="button" data-lightbox-control="next" data-lightbox-next aria-label="다음 이미지">›</button></div><aside class="lightbox-info ${state.infoOpen ? "" : "is-hidden"}"><h2>정보 (i)</h2><dl><dt>조건</dt><dd><code>${esc(details.title ?? "조건 정보 없음")}</code></dd><dt>기대 결과</dt><dd>${esc(details.expected ?? "—")}</dd><dt>뷰포트</dt><dd>${esc(imageViewportLabel)}</dd><dt>요청 뷰포트</dt><dd>${esc(requestedViewports)}</dd><dt>픽셀 크기</dt><dd>${current.dimensions ? `${current.dimensions.width}×${current.dimensions.height}` : "크기 미상"}</dd><dt>audit</dt><dd>${esc(details.audit ? summarizeAudit(details.audit) : "audit 없음")}</dd><dt>생성 run</dt><dd>${details.requestFile ? `<a href="${esc(routeFor(current.session, "runs", details.requestFile.split("/").slice(0, -1).join("/")))}" data-journal-route="${esc(routeFor(current.session, "runs", details.requestFile.split("/").slice(0, -1).join("/")))}">${esc(details.requestFile.split("/").slice(0, -1).join("/"))}</a>` : "—"}</dd><dt>브리프</dt><dd>${current.briefRef ? esc(current.briefCaption || "브리프 참조") : "—"}</dd></dl><div class="kbd-hints"><span><kbd>←</kbd><kbd>→</kbd> 이동</span><span><kbd>P</kbd> 고정</span><span><kbd>1</kbd> 원본 크기</span><span><kbd>i</kbd> 정보</span><span><kbd>Esc</kbd> 닫기</span></div></aside></div>`;
  const focusTarget = activeControl ? lightbox.querySelector(`[data-lightbox-control="${activeControl}"]`) : null;
  if (focusTarget) focusTarget.focus({ preventScroll: true });
  else if (activeControl === "frame") $("[data-lightbox-control=pin]", lightbox)?.focus({ preventScroll: true });
  if (originalFramePosition) {
    const nextFrame = $(".lightbox-image-frame.is-original", lightbox);
    if (nextFrame?.dataset.lightboxFramePath === originalFramePosition.path) {
      nextFrame.scrollLeft = originalFramePosition.scrollLeft;
      nextFrame.scrollTop = originalFramePosition.scrollTop;
    }
  }
}
function summarizeAudit(audit) {
  if (typeof audit === "string") return audit;
  const overflow = audit.overflow?.horizontal === true || audit.overflow === true ? "overflow 있음" : audit.overflow?.horizontal === false || audit.overflow === false ? "overflow 없음" : "overflow 미확인";
  const consoleCount = Array.isArray(audit.console) ? audit.console.length : 0;
  const pageErrors = Array.isArray(audit.pageErrors) ? audit.pageErrors.length : 0;
  const axe = Array.isArray(audit.axe) ? audit.axe.map((item) => `${item.id} (${item.impact})`).join(", ") : "0";
  return `${overflow} · console ${consoleCount} · pageErrors ${pageErrors} · axe ${axe}`;
}
function setImageIndex(index) {
  if (!state.currentImageSet.length) return;
  state.imageIndex = (index + state.currentImageSet.length) % state.currentImageSet.length;
  state.naturalSize = false;
  renderLightbox();
}
function closeLightbox() {
  if (!lightbox.open) return;
  state.pinnedImage = null;
  lightbox.close();
}
function returnLightboxFocus() {
  if (state.opener?.isConnected) { state.opener.focus?.({ preventScroll: true }); return; }
  if (!state.openerMeta) return;
  const button = [...document.querySelectorAll("button[data-image-path]")].find((item) => item.dataset.imagePath === state.openerMeta.path && (item.dataset.imageSession ?? state.session) === state.openerMeta.session);
  button?.focus({ preventScroll: true });
}
async function switchLightboxFolder(folderPath) {
  const images = imagesInFolder(state.lightboxData, folderPath, state.lightboxSession);
  state.lightboxScope = "folder";
  state.lightboxFolder = folderPath;
  state.lightboxBriefPath = "";
  state.currentImageSet = images;
  state.imageIndex = 0;
  renderLightbox();
}

function refreshOpenLightbox(data) {
  const current = currentImage();
  if (!current || !data) return;
  const session = state.lightboxSession;
  const previousIndex = state.imageIndex;
  const all = allImages(data, session);
  const findImage = (image) => all.find((item) => item.path === image.path && (item.session ?? session) === (image.session ?? session));
  const refreshedCurrent = findImage(current);
  const selectedImage = refreshedCurrent ?? current;
  let images = state.lightboxScope === "brief"
    ? imagesInBrief(data, session, state.lightboxBriefPath)
    : state.lightboxFolder ? imagesInFolder(data, state.lightboxFolder, session) : all;
  if (!images.some((item) => item.path === selectedImage.path && (item.session ?? session) === (selectedImage.session ?? session))) {
    images.splice(Math.min(Math.max(0, previousIndex), images.length), 0, selectedImage);
  }
  state.currentImageSet = images;
  state.imageIndex = imageIndexFor(images, selectedImage, previousIndex);
  if (state.pinnedImage) state.pinnedImage = findImage(state.pinnedImage) ?? state.pinnedImage;
  state.lightboxData = data;
  renderLightbox();
}

function activateRoute(route) {
  const parsed = route.replace(/^#\/?/, "").split("/");
  if (parsed[0] !== "s") return;
  try { navigate(decodeURIComponent(parsed[1]), TABS.includes(parsed[2]) ? parsed[2] : "current", parsed[3] ? decodeURIComponent(parsed.slice(3).join("/")) : ""); } catch { /* Invalid hash routes are ignored. */ }
}
function connectEvents() {
  state.eventSource?.close();
  const source = new EventSource("/events");
  state.eventSource = source;
  source.addEventListener("open", () => { connection.textContent = "실시간 연결됨"; connection.classList.remove("is-offline"); });
  source.addEventListener("ready", (event) => {
    const ready = JSON.parse(event.data);
    if (ready.watcherAvailable) { connection.textContent = "실시간 연결됨"; connection.classList.remove("is-offline"); }
    else { connection.textContent = "실시간 감시 불가"; connection.classList.add("is-offline"); }
  });
  source.addEventListener("change", async (event) => {
    const change = JSON.parse(event.data);
    const priorMockup = state.selectedMockup;
    const changedPaths = Array.isArray(change.paths) ? change.paths : [change.path ?? ""];
    await reloadIndex();
    if (!state.session) return;
    const sessionPaths = pathsForSession(changedPaths, state.session);
    if (sessionPaths.length) {
      await loadSelected({ incremental: true });
      if (state.tab === "mockups" && priorMockup && sessionPaths.includes(priorMockup)) {
        state.mockupUpdated = new Date().toISOString();
        renderMockups();
      }
      if (state.tab === "documents" && state.selectedDocument && sessionPaths.includes(state.selectedDocument)) markDocumentChanged();
    }
    if (lightbox.open) {
      const lightboxPaths = pathsForSession(changedPaths, state.lightboxSession);
      if (shouldRefreshLightbox(lightboxPaths, currentImage(), state.pinnedImage)) {
        try {
          const data = state.lightboxSession === state.session ? state.sessionData : await getJson("/api/session", { dir: state.lightboxSession });
          refreshOpenLightbox(data);
        } catch {
          announcer.textContent = "열린 이미지 정보를 갱신할 수 없습니다.";
        }
      }
    }
  });
  source.addEventListener("watch-unavailable", () => { connection.textContent = "실시간 감시 불가"; connection.classList.add("is-offline"); });
  source.addEventListener("error", () => { connection.textContent = "연결 끊김 · 재연결 중"; connection.classList.add("is-offline"); });
}
async function reloadIndex() {
  try {
    const result = await getJson("/api/sessions");
    state.sessions = result.sessions;
    state.groups = result.groups;
    state.waitingCount = result.waitingCount;
    renderSessions();
    if (!state.sessions.some((row) => row.dir === state.session)) state.session = state.sessions[0]?.dir ?? "";
    if (!detailSection.hidden) stopLoading();
    return true;
  } catch (error) {
    showLoadingMessage(`세션 목록을 읽을 수 없습니다: ${error.message}`);
    return false;
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  if (target.tagName === "A" && target.getAttribute("href")?.startsWith("#") && !target.dataset.journalRoute) {
    event.preventDefault();
    const id = decodeURIComponent(target.getAttribute("href").slice(1));
    document.getElementById(id)?.scrollIntoView({ block: "start" });
    return;
  }
  if (target.id === "back-to-sessions") { document.body.classList.remove("detail-open"); $("#session-filter").focus(); return; }
  if (target.dataset.copyValue !== undefined) {
    try { await navigator.clipboard.writeText(target.dataset.copyValue); target.dataset.copied = "true"; const old = target.textContent; target.textContent = "복사됨"; setTimeout(() => { target.textContent = old; delete target.dataset.copied; }, 900); } catch { target.textContent = target.dataset.copyValue; }
    return;
  }
  if (target.dataset.session) { state.selectedFolder = ""; state.selectedMockup = ""; state.selectedDocument = ""; state.selectedRun = ""; state.mockupWidth = null; navigate(target.dataset.session); return; }
  if (target.dataset.tab) {
    if (target.dataset.tab !== state.tab || target.dataset.run) navigate(state.session, target.dataset.tab, target.dataset.run ?? "");
    return;
  }
  if (target.dataset.briefGallery !== undefined) { jumpToGalleryTarget(BRIEF_GALLERY_TARGET); return; }
  if (target.dataset.folder) { jumpToGalleryTarget(target.dataset.folder); return; }
  if (target.dataset.imagePath) {
    const session = target.dataset.imageSession ?? state.session;
    if (session === state.session) {
      const image = decorateImage(session, target.dataset.imagePath);
      const all = allImages().map((item) => ({ ...item, session }));
      const briefGroup = target.closest(".brief-file-group");
      const set = briefGroup
        ? [...briefGroup.querySelectorAll("[data-image-path]")].map((button) => all.find((item) => item.path === button.dataset.imagePath) ?? decorateImage(session, button.dataset.imagePath)).map((item) => ({ ...item, briefRef: true }))
        : all;
      const briefPath = briefGroup?.querySelector(".file-path")?.textContent?.trim() ?? "";
      openLightbox(image, set, target, state.sessionData, briefGroup ? "brief" : "folder", briefPath);
    } else {
      try {
        const data = await getJson("/api/session", { dir: session });
        const set = data.folders.flatMap((folder) => folder.groups.flatMap((group) => group.images.map((item) => ({ ...item, session, folder: folder.path, group: { ...group, images: undefined } }))));
        const image = set.find((item) => item.path === target.dataset.imagePath) ?? { path: target.dataset.imagePath, session, dimensions: null, group: null };
        openLightbox(image, set, target, data);
      } catch (error) { announcer.textContent = `이미지를 읽을 수 없습니다: ${error.message}`; }
    }
    return;
  }
  if (target.dataset.mockup) { state.selectedMockup = target.dataset.mockup; state.mockupWidth = null; navigate(state.session, "mockups", target.dataset.mockup); return; }
  if (target.dataset.width) { state.mockupWidth = target.dataset.width === "fit" ? "fit" : Number(target.dataset.width); renderMockups(); return; }
  if (target.dataset.openMockup) { window.open(mediaUrl(state.session, target.dataset.openMockup), "_blank", "noopener"); return; }
  if (target.dataset.document) { navigate(state.session, "documents", target.dataset.document); return; }
  if (target.dataset.rawToggle !== undefined) {
    if (!state.documentText) return;
    const raw = target.dataset.rawToggle === "false";
    const view = $("#document-view");
    target.dataset.rawToggle = String(raw);
    target.textContent = raw ? "렌더링" : "원문";
    const currentContent = $(".markdown-content, pre.raw-view", view);
    if (currentContent) currentContent.outerHTML = raw ? `<pre class="raw-view" tabindex="0" aria-label="문서 원문">${esc(state.documentText.text)}</pre>` : `<article class="markdown-content">${state.documentText.html}</article>`;
    const toc = $(".markdown-toc", view);
    if (toc) toc.hidden = raw;
    return;
  }
  if (target.dataset.reloadDocument !== undefined) { await loadDocument(state.selectedDocument); return; }
  if (target.dataset.run) { state.selectedRun = target.dataset.run; navigate(state.session, "runs", target.dataset.run); return; }
  if (target.dataset.lightboxPrev !== undefined) { setImageIndex(state.imageIndex - 1); return; }
  if (target.dataset.lightboxNext !== undefined) { setImageIndex(state.imageIndex + 1); return; }
  if (target.dataset.lightboxClose !== undefined) { closeLightbox(); return; }
  if (target.dataset.lightboxInfo !== undefined) { state.infoOpen = !state.infoOpen; renderLightbox(); return; }
  if (target.dataset.pinImage !== undefined) { state.pinnedImage = state.pinnedImage ? null : { ...currentImage(), session: currentImage().session ?? state.session }; renderLightbox(); return; }
  if (target.dataset.journalRoute) { event.preventDefault(); activateRoute(target.dataset.journalRoute); return; }
  if (target.classList.contains("history-thumb")) return;
});

document.addEventListener("change", (event) => {
  if (event.target.id === "folder-select") jumpToGalleryTarget(event.target.value);
  if (event.target.matches("[data-lightbox-folder]")) switchLightboxFolder(event.target.value);
});
document.addEventListener("keydown", (event) => {
  if (lightbox.open) {
    if (event.key === "Escape") { event.preventDefault(); closeLightbox(); }
    else if (event.key === "ArrowLeft" && !document.activeElement.matches(".lightbox-image-frame.is-original")) { event.preventDefault(); setImageIndex(state.imageIndex - 1); }
    else if (event.key === "ArrowRight" && !document.activeElement.matches(".lightbox-image-frame.is-original")) { event.preventDefault(); setImageIndex(state.imageIndex + 1); }
    else if (event.key.toLowerCase() === "i") { event.preventDefault(); state.infoOpen = !state.infoOpen; renderLightbox(); }
    else if (event.key === "1") {
      event.preventDefault();
      state.naturalSize = !state.naturalSize;
      renderLightbox();
      if (state.naturalSize) $(".lightbox-image-frame.is-original", lightbox)?.focus({ preventScroll: true });
    }
    else if (event.key.toLowerCase() === "p") { event.preventDefault(); state.pinnedImage = state.pinnedImage ? null : { ...currentImage(), session: currentImage().session ?? state.session }; renderLightbox(); }
    else if (event.key === "Tab") trapFocus(event);
    return;
  }
  if (event.target.matches("[role=tab]")) {
    const index = TABS.indexOf(event.target.dataset.tab);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      state.pendingTabFocus = next;
      navigate(state.session, next);
    }
  }
});
function trapFocus(event) {
  const items = [...lightbox.querySelectorAll('button:not([disabled]), a[href], select, input, [tabindex="0"]')].filter((item) => item.offsetParent !== null);
  if (!items.length) return;
  const first = items[0]; const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
$("#session-filter").addEventListener("input", renderSessions);
$("#back-to-sessions").addEventListener("click", () => document.body.classList.remove("detail-open"));
window.addEventListener("hashchange", () => {
  const route = routeState();
  if (route && (route.session !== state.session || route.tab !== state.tab || route.target !== state.target)) {
    window.scrollTo(0, 0);
    if (route.session !== state.session) {
      state.selectedFolder = "";
      state.galleryTarget = "";
      state.selectedMockup = "";
      state.selectedDocument = "";
      state.selectedRun = "";
      state.mockupWidth = null;
    }
    state.session = route.session; state.tab = route.tab; state.target = route.target;
    if (window.innerWidth < 800) document.body.classList.add("detail-open");
    loadSelected();
  }
});
window.addEventListener("resize", () => {
  const isMobile = window.innerWidth < 800;
  if (isMobile !== wasMobileViewport) {
    if (isMobile && state.session) document.body.classList.add("detail-open");
    else if (!isMobile) document.body.classList.remove("detail-open");
    wasMobileViewport = isMobile;
  }
  if (state.tab === "mockups") renderMockups();
});
lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
lightbox.addEventListener("close", returnLightboxFocus);

async function init() {
  connectEvents();
  startLoading();
  if (!await reloadIndex()) return;
  const route = routeState();
  if (!state.sessions.length) { showLoadingMessage("세션 저널이 비어 있습니다."); return; }
  if (route && state.sessions.some((row) => row.dir === route.session)) {
    state.session = route.session; state.tab = route.tab; state.target = route.target;
  } else {
    const active = state.groups.waiting[0] ?? state.groups.active[0] ?? state.sessions[0];
    state.session = active.dir;
    history.replaceState(null, "", routeFor(state.session));
  }
  if (window.innerWidth < 800) document.body.classList.add("detail-open");
  await loadSelected();
}
init();
