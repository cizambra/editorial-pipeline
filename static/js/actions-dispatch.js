// Extracted from static/js/bootstrap.js during runtime refactor.

document.addEventListener("click", e => {
  const blocked = e.target.closest(".role-disabled");
  if (blocked) {
    e.preventDefault();
    e.stopPropagation();
    authError(blocked.dataset.roleTooltip || roleMessage(blocked.dataset.minRole || "admin"));
  }
}, true);

const CORE_ACTIONS = new Set([
  "dl", "copy", "copy-doc", "doc-view", "mk-select", "repurpose", "social-publish",
  "regen", "open-run", "open-thumb", "del-run", "goto-marketing", "queue-pipeline", "queue-use"
]);
const IDEAS_ACTIONS = new Set(["idea-status", "idea-del", "idea-pipeline", "idea-write"]);
const THUMB_ACTIONS = new Set(["pick-concept", "save-thumb", "dl-thumb", "del-thumb"]);
const AUDIENCE_ACTIONS = new Set(["aud-sync", "aud-tab", "aud-insights-load", "ins-rec-tab", "aud-sub-open", "aud-filt", "aud-page"]);
const NOTES_ACTIONS = new Set([
  "sn-new-post", "sn-filter", "sn-batch-toggle", "sn-batch-del", "sn-batch-show-all", "sn-note-open",
  "sn-shared", "sn-signal", "sn-edit-open", "sn-edit-cancel", "sn-edit-save", "sn-promote",
  "sn-repurpose", "sn-plat-tab", "sn-note-save", "sn-rep-thumb", "sn-sa-open", "sn-sa-cancel",
  "sn-sa-toggle", "sn-sa-confirm", "cmp-platform", "cmp-repurpose", "cmp-start-over"
]);
const QUOTE_ACTIONS = new Set([
  "qt-copy", "qt-run-select", "qt-shared", "qt-signal-pos", "qt-signal-neg",
  "qt-repurpose", "qt-rep-tab", "qt-rep-publish", "qt-promote"
]);
const PUBLISHING_ACTIONS = new Set([
  "mk-plat-tab", "sched-open", "sched-cancel", "sched-confirm", "sched-del",
  "sched-hard-del", "sched-gen-image", "sched-signal"
]);

function handleActionClick(action) {
  const kind = action.dataset.a;
  const minRole = requiredRoleForAction(action);
  if (minRole && !hasRole(minRole)) {
    authError(roleMessage(minRole));
    return;
  }
  const menu = action.closest("details");
  const handled =
    handleCoreAction(action, kind) ||
    handleIdeaAction(action, kind) ||
    handleThumbnailAction(action, kind) ||
    handleAudienceAction(action, kind) ||
    handleNoteAction(action, kind) ||
    handleQuoteAction(action, kind) ||
    handlePublishingAction(action, kind);
  if (!handled) return false;
  if (action.dataset.closeMenu && menu) menu.open = false;
  return true;
}

function bindActionGroup(targets, kinds) {
  const nodes = targets === "document"
    ? [document]
    : targets.map(id => $(id)).filter(Boolean);
  nodes.forEach(node => {
    node.addEventListener("click", e => {
      const action = e.target.closest("[data-a]");
      if (!action || !kinds.has(action.dataset.a)) return;
      handleActionClick(action);
    });
  });
}
