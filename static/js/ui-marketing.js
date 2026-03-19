// Extracted marketing UI helpers from bootstrap.js

function handleMarketingUiClick(target) {
      const marketingTab = target.closest("[data-mk-tab]");
      if (marketingTab) {
        setMarketingTab(marketingTab.dataset.mkTab);
        return;
      }

      const scope = target.closest("[data-scope]");
      if (scope) {
        S.social[scope.dataset.scope][scope.dataset.kind] = scope.dataset.val;
        view(scope.dataset.scope);
        return;
      }

      const socTab = target.closest("[data-soc-tab]");
      if (socTab) {
        const bar = socTab.closest(".soc-tab-bar");
        const shell = socTab.closest(".soc-shell");
        if (!bar || !shell) return;
        bar.querySelectorAll(".soc-tab").forEach(b => b.classList.remove("active"));
        socTab.classList.add("active");
        shell.querySelectorAll(".soc-panel").forEach(p => p.classList.toggle("active", p.dataset.platform === socTab.dataset.socTab));
        return;
      }

      const mkAsset = target.closest("[data-mk-src]");
      if (mkAsset) {
        S.mkView = { source: mkAsset.dataset.mkSrc, lang: mkAsset.dataset.mkLang };
        renderMkReadingPane();
        return;
      }

      const rteBtn = target.closest("[data-rte-cmd]");
      if (rteBtn) {
        const cmd = rteBtn.dataset.rteCmd;
        if (cmd === "createLink") {
          const url = prompt("URL:");
          if (url) document.execCommand("createLink", false, url);
        } else {
          document.execCommand(cmd, false, null);
        }
        rteBtn.closest(".rte-wrap").querySelector(".rte-body").focus();
        return;
      }

      const navBtn = target.closest(".mk-nav-btn");
      if (navBtn) {
        const textId = navBtn.dataset.navId;
        const section = $(textId + "-section");
        const counter = $(textId + "-counter");
        const textEl = $(textId);
        if (!section || !textEl) return;
        const posts = JSON.parse(section.dataset.posts || "[]");
        let idx = parseInt(section.dataset.idx || "0", 10) + parseInt(navBtn.dataset.dir, 10);
        idx = Math.max(0, Math.min(posts.length - 1, idx));
        section.dataset.idx = idx;
        if (textEl.tagName === 'TEXTAREA') textEl.value = posts[idx];
        else if (textEl.isContentEditable) textEl.innerHTML = renderMarkdown(posts[idx]);
        else textEl.textContent = posts[idx];
        if (counter) counter.textContent = (idx + 1) + " / " + posts.length;
        section.querySelectorAll(".mk-nav-btn").forEach(b => {
          b.disabled = parseInt(b.dataset.dir, 10) === -1 ? idx === 0 : idx === posts.length - 1;
        });
      }
    }

    function bindUiGroup(targets, handler) {
      const nodes = targets === "document"
        ? [document]
        : targets.map(id => $(id)).filter(Boolean);
      nodes.forEach(node => {
        node.addEventListener("click", e => {
          if (e.target.closest("[data-a]")) return;
          handler(e.target);
        });
      });
    }

    function bindInputGroup(targets, handler) {
      const nodes = targets === "document"
        ? [document]
        : targets.map(id => $(id)).filter(Boolean);
      nodes.forEach(node => {
        node.addEventListener("input", e => handler(e.target));
      });
    }

    function handleSocialTextInput(target) {
      if (!target.classList || !target.classList.contains("social-text") || !target.dataset.socCount) return;
      const el = document.getElementById(target.dataset.socCount);
      if (!el) return;
      const len = target.value.length;
      const max = parseInt(target.dataset.socMax || "0", 10);
      el.textContent = len + (max ? " / " + max : " chars");
      el.classList.toggle("near-limit", max > 0 && len > max * 0.9);
      el.classList.toggle("over-limit", max > 0 && len > max);
    }

    bindActionGroup("document", CORE_ACTIONS);
    bindActionGroup(["page-ideas"], IDEAS_ACTIONS);
    bindActionGroup(["page-thumbnail"], THUMB_ACTIONS);
    bindActionGroup(["page-audience", "page-dashboard"], AUDIENCE_ACTIONS);
    bindActionGroup(["page-marketing"], NOTES_ACTIONS);
    bindActionGroup(["page-marketing"], QUOTE_ACTIONS);
    bindActionGroup(["page-marketing"], PUBLISHING_ACTIONS);
