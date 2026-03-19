// Extracted UI helpers from bootstrap.js

function handleGlobalUiClick(target) {
      if (target.id === "run-meta-view" || target.closest("#run-meta-view")) {
        mode("history");
        return;
      }

      const nav = target.closest("[data-mode]");
      if (nav) {
        mode(nav.dataset.mode);
        return;
      }

      const tab = target.closest("[data-rt]");
      if (tab) {
        rt(tab.dataset.rt);
        return;
      }

      const stageRt = target.closest("[data-stage-rt]");
      if (stageRt && (stageRt.classList.contains("done") || stageRt.classList.contains("skipped"))) {
        const key = stageRt.dataset.stageKey;
        if (key === "thumbnail") { mode("thumbnail"); }
        else if (key === "reflection_social" || key === "companion_social") { mode("marketing"); setMarketingTab("library"); }
        else if (key === "reflection_es") { rt("reflection"); lg("global", "es"); $("results").scrollIntoView({ behavior: "smooth", block: "start" }); }
        else { rt(stageRt.dataset.stageRt); $("results").scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }

      const mdView = target.closest("[data-md-view]");
      if (mdView) {
        setMdView(mdView.dataset.mdTarget, mdView.dataset.mdView);
        return;
      }

      const thumbTab = target.closest("[data-th-tab]");
      if (thumbTab) {
        setThumbTab(thumbTab.dataset.thTab);
        return;
      }

      const lang = target.closest("[data-lg]");
      if (lang) {
        lg(lang.dataset.lg, lang.dataset.lang);
        return;
      }
    }
