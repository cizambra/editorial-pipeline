    const S = {
      mode: "pipeline",
      theme: localStorage.getItem("ep_theme") || "light",
      src: "file",
      coSrc: "file",
      file: null,
      fileText: "",
      run: false,
      q: [],
      social: {
        pipe: { source: "reflection", lang: "en" },
        mk: { source: "reflection", lang: "en" }
      },
      runData: {
        title: "",
        url: "",
        reflectionEn: "",
        reflectionEs: "",
        companionTitle: "",
        companionEn: "",
        companionEs: "",
        socials: { reflection: { en: null, es: null }, companion: { en: null, es: null } },
        related: [],
        runId: null
      },
      mk: [],
      hist: [],
      ideas: [],
      thumbs: [],
      mkSelected: null,
      mkView: { source: "reflection", lang: "en" },
      marketingTab: "library",
      thumbSelected: null,
      thumbConceptSelected: null,
      thumbTab: "studio",
      thumbsLoaded: false,
      thumbDraft: { concepts: [], review: false },
      coTimer: null,
      mkTimer: null,
      thTimer: null,
      snBatches: [],
      snSelectedBatch: null,
      snNotes: [],
      snMode: "empty",
      snSelectedNote: null,
      snBatchNotesCache: {},
      snOpenBatches: {},
      snBatchShowAll: {},
      snSearch: { q: "", shared: false, repurposed: false, signal: "" },
      snSearchResults: [],
      snSearchTimer: null,
      compose: { platform: "substack_note", texts: { linkedin: "", threads: "", instagram: "", substack_note: "" }, repurpose: null },
      quotesRuns: [],
      quotesRunId: null,
      quotesData: [],
      auth: {
        ready: false,
        user: null,
        authMode: "local",
        users: [],
        invites: [],
        audit: [],
        auditFilter: "all"
      }
    };

    const TONES = ["Very warm", "Warm", "Warm", "Balanced", "Balanced", "Balanced", "Balanced", "Direct", "Direct", "Blunt", "Very blunt"];
    const PL = { linkedin: "LinkedIn", instagram: "Instagram", threads: "Threads", substack_note: "Substack Note" };
    const ROLE_LEVELS = { operator: 0, admin: 1, superadmin: 2 };
    const STATIC_ROLE_RULES = [
      { selector: "#template-upload", minRole: "superadmin" },
      { selector: "#articles-refresh", minRole: "superadmin" },
      { selector: "#articles-new", minRole: "superadmin" },
      { selector: "#cfg-save", minRole: "superadmin" },
      { selector: "#create-invite-btn", minRole: "superadmin" },
      { selector: "#audit-refresh-btn", minRole: "superadmin" },
      { selector: "#dismiss-cp", minRole: "superadmin" },
      { selector: "#sub-test-conn", minRole: "admin" },
      { selector: "#sn-gen-btn", minRole: "admin" },
      { selector: "#aud-refresh-btn", minRole: "admin" }
    ];
    const ACTION_ROLE_RULES = {
      "social-publish": "admin",
      "sched-open": "admin",
      "sched-confirm": "admin",
      "sched-del": "admin",
      "sched-hard-del": "superadmin",
      "aud-sync": "admin",
      "sn-batch-del": "superadmin",
      "sn-shared": "admin",
      "sn-signal": "admin",
      "sn-edit-save": "admin",
      "sn-promote": "admin",
      "sn-repurpose": "admin",
      "sn-note-save": "admin",
      "sn-sa-open": "admin",
      "sn-sa-confirm": "admin",
      "idea-del": "admin",
      "del-run": "superadmin",
      "del-thumb": "superadmin",
      "qt-shared": "admin",
      "qt-signal-pos": "admin",
      "qt-signal-neg": "admin",
      "qt-repurpose": "admin",
      "qt-rep-publish": "admin",
      "qt-promote": "admin"
    };
    const TASK_DETAILS = {
      related: "Waiting for related article retrieval.",
      reflection_es: "Waiting for the translation lane.",
      reflection_social: "Waiting for reflection social outputs.",
      companion: "Waiting for the paid companion lane.",
      companion_social: "Waiting for companion social outputs.",
      thumbnail: "Waiting for the thumbnail lane.",
      tagging: "Waiting for pillar tagging.",
      quotes: "Waiting for quote extraction."
    };

    const $ = id => document.getElementById(id);
    const H = s => String(s || "").replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
    const slug = s => String(s || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document";
    const dt = v => { try { return new Date(v).toLocaleString(); } catch (e) { return v || ""; } };

    function roleLevel(role) {
      return ROLE_LEVELS[String(role || "operator")] ?? 0;
    }

    function hasRole(minRole) {
      if (!minRole) return true;
      return roleLevel(S.auth.user && S.auth.user.role) >= roleLevel(minRole);
    }

    function roleMessage(minRole) {
      return (minRole === "superadmin" ? "Superadmin" : "Admin") + " access required";
    }

    function requiredRoleForAction(action) {
      return ACTION_ROLE_RULES[action.dataset.a] || "";
    }

    function setRoleAccessState(node, minRole) {
      if (!node || !minRole) return;
      const allowed = hasRole(minRole);
      node.classList.toggle("role-disabled", !allowed);
      node.dataset.minRole = minRole;
      if (!allowed) {
        node.dataset.roleTooltip = roleMessage(minRole);
        node.setAttribute("title", roleMessage(minRole));
      } else {
        delete node.dataset.roleTooltip;
        if (node.getAttribute("title") === roleMessage(minRole)) node.removeAttribute("title");
      }
      if (!allowed) node.setAttribute("aria-disabled", "true");
      else node.removeAttribute("aria-disabled");
    }

    function applyRoleUi(root) {
      const scope = root || document;
      STATIC_ROLE_RULES.forEach(rule => {
        scope.querySelectorAll(rule.selector).forEach(node => setRoleAccessState(node, rule.minRole));
      });
      scope.querySelectorAll("[data-a]").forEach(node => {
        const minRole = requiredRoleForAction(node);
        if (minRole) setRoleAccessState(node, minRole);
      });
      const queueToggle = $("queue-social");
      if (queueToggle) queueToggle.disabled = !S.auth.user;
      const settingsReadOnly = !hasRole("superadmin");
      ["cfg-voice", "cfg-comp", "cfg-es", "cfg-th"].forEach(id => {
        const field = $(id);
        if (!field) return;
        field.readOnly = settingsReadOnly;
        field.classList.toggle("role-disabled", settingsReadOnly);
        if (settingsReadOnly) {
          field.dataset.roleTooltip = "Superadmin access required";
          field.setAttribute("title", "Superadmin access required");
        } else {
          delete field.dataset.roleTooltip;
          if (field.getAttribute("title") === "Superadmin access required") field.removeAttribute("title");
        }
      });
      document.querySelectorAll(".md-mode [data-md-view='edit']").forEach(button => {
        setRoleAccessState(button, "superadmin");
      });
      if (settingsReadOnly) {
        ["voice", "comp", "es", "th"].forEach(target => setMdView(target, "read"));
      }
    }

    let _roleUiPending = false;
    function scheduleRoleUiRefresh() {
      if (_roleUiPending) return;
      _roleUiPending = true;
      requestAnimationFrame(() => {
        _roleUiPending = false;
        if (document.body) applyRoleUi(document);
      });
    }

    function timeAgo(ts) {
      if (!ts) return "";
      const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (s < 60) return s + "s ago";
      if (s < 3600) return Math.floor(s / 60) + " min ago";
      if (s < 86400) return Math.floor(s / 3600) + "h ago";
      return Math.floor(s / 86400) + "d ago";
    }

    function wordCount(text) {
      if (!text) return 0;
      return text.trim().split(/\s+/).filter(Boolean).length;
    }

    function updateRunMeta() {
      const d = S.runData;
      const title = d.title || "Untitled run";
      $("run-meta-title").textContent = title.length > 65 ? title.slice(0, 65) + "…" : title;
      $("run-meta-time").textContent = timeAgo(d.timestamp || d.runStartTs);
      $("run-meta-cost").textContent = typeof d.costUsd === "number" ? "$" + d.costUsd.toFixed(4) : "";
      const wc = wordCount(d.reflectionEn);
      const wcSep = $("run-meta-wc-sep");
      if (wc) {
        $("run-meta-wc").textContent = wc.toLocaleString() + " words";
        wcSep.style.display = "";
      } else {
        $("run-meta-wc").textContent = "";
        wcSep.style.display = "none";
      }
      $("run-meta-view").dataset.runId = d.runId || "";
      $("run-meta-view").disabled = !d.runId;
      const tagsEl = $("run-meta-tags");
      if (tagsEl) {
        const tags = Array.isArray(d.tags) && d.tags.length ? d.tags : [];
        tagsEl.innerHTML = tags.map(t => '<span class="tag">' + H(t) + '</span>').join("");
      }
    }

    function updateResultsStages() {
      const el = $("results-stage-list");
      if (!el) return;
      const tasks = S.pipelineTasks || {};
      const order = [
        ["related", "Related articles", "related"],
        ["reflection_es", "Translation", "reflection"],
        ["reflection_social", "Reflection social", "reflection"],
        ["companion", "Paid companion", "companion"],
        ["companion_social", "Companion social", "companion"],
        ["thumbnail", "Thumbnail", "thumbnail"],
        ["tagging", "Pillar tags", "reflection"],
        ["quotes", "Quote extraction", "quotes"]
      ];
      el.innerHTML = order.map(([key, label, target], i) => {
        const t = tasks[key] || {};
        const state = t.state || "todo";
        const badge = { done: "Done", running: "Running", error: "Error", skipped: "Skipped", todo: "Waiting" }[state] || "Waiting";
        return '<button class="result-stage ' + state + '" data-stage-rt="' + target + '" data-stage-key="' + key + '" title="Go to ' + H(label) + '">' +
          '<div class="result-stage-num">0' + (i + 1) + '</div>' +
          '<div><div class="result-stage-name">' + H(label) + '</div>' +
          '<div class="result-stage-badge">' + badge + '</div></div>' +
        '</button>';
      }).join("");
    }

    function setTheme(v) {
      S.theme = v === "dark" ? "dark" : "light";
      document.body.dataset.theme = S.theme;
      localStorage.setItem("ep_theme", S.theme);
      const isDark = S.theme === "dark";
      const sunSvg = '<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
      const moonSvg = '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
      const themeText = isDark ? "Light mode" : "Dark mode";
      const themeIco = isDark ? sunSvg : moonSvg;
      const lbl = $("theme-label");
      const ico = $("theme-icon");
      if (lbl) lbl.textContent = themeText;
      if (ico) ico.innerHTML = themeIco;
    }
