// Extracted from static/js/app.js during runtime refactor.

    function mode(m) {
      S.mode = m;
      localStorage.setItem("ep_page", m);
      document.querySelectorAll(".page").forEach(node => node.classList.remove("active"));
      document.querySelectorAll(".nav").forEach(node => node.classList.toggle("active", node.dataset.mode === m));
      const _sidebar = document.querySelector(".sidebar");
      const _drawerOverlay = document.getElementById("mobile-drawer-overlay");
      const _hamburger = document.getElementById("mobile-hamburger");
      if (_sidebar) _sidebar.classList.remove("open");
      if (_drawerOverlay) _drawerOverlay.classList.remove("show");
      if (_hamburger) _hamburger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      $("page-" + m).classList.add("active");
      if (m === "marketing") loadMk();
      if (m === "history") loadHist();
      if (m === "ideas") loadIdeas();
      if (m === "dashboard") { loadDash(); loadAudience(); }
      if (m === "audience") loadAudienceList();
      if (m === "settings") {
        loadTemplate();
        loadArticles();
        loadCfg();
        loadUsers();
      }
      if (m === "thumbnail" && S.thumbTab === "library") loadThumbs();
    }

    function runChip(on, msg) {
      $("run-chip").classList.toggle("show", !!on);
      S.run = !!on;
      if (msg) $("run-chip-text").textContent = msg;
    }

    function tone() {
      $("tone-label").textContent = TONES[parseInt($("tone").value, 10)] || "Balanced";
    }

    function pipelineSource(v) {
      S.src = v;
      $("src-file").classList.toggle("active", v === "file");
      $("src-paste").classList.toggle("active", v === "paste");
      $("file-pane").classList.toggle("hide", v !== "file");
      $("paste-pane").classList.toggle("hide", v !== "paste");
      validPipe();
    }

    function companionSource(v) {
      S.coSrc = v;
      $("co-src-file").classList.toggle("active", v === "file");
      $("co-src-paste").classList.toggle("active", v === "paste");
      $("co-file-pane").classList.toggle("hide", v !== "file");
      $("co-paste-pane").classList.toggle("hide", v !== "paste");
    }

    function validPipe() {
      const hasBody = S.src === "file" ? !!S.file : !!$("reflection-text").value.trim();
      $("run-pipe").disabled = !($("article-title").value.trim() && hasBody);
    }

    function resetPipelineTasks() {
      S.pipelineTasks = {};
      [
        ["related", "Related articles", TASK_DETAILS.related],
        ["reflection_es", "Reflection translation", TASK_DETAILS.reflection_es],
        ["reflection_social", "Reflection socials", TASK_DETAILS.reflection_social],
        ["companion", "Paid companion", TASK_DETAILS.companion],
        ["companion_social", "Companion socials", TASK_DETAILS.companion_social],
        ["thumbnail", "Thumbnail lane", TASK_DETAILS.thumbnail],
        ["tagging", "Pillar tags", TASK_DETAILS.tagging],
        ["quotes", "Quote extraction", TASK_DETAILS.quotes]
      ].forEach(([key, title, detail]) => setTask(key, "todo", "Waiting", title, detail));
    }

    function setTask(key, state, badge, title, detail) {
      S.pipelineTasks[key] = {
        state,
        badge,
        title: title || key,
        detail: detail || ""
      };
      renderPipelineProgress();
      updateResultsStages();
    }

    function renderPipelineProgress() {
      const tasks = Object.values(S.pipelineTasks || {});
      if (!tasks.length) return;
      const complete = tasks.filter(task => task.state === "done" || task.state === "skipped").length;
      const running = tasks.find(task => task.state === "running");
      const error = tasks.find(task => task.state === "error");
      const fill = $("pipe-progress-fill");
      const percent = Math.round((complete / tasks.length) * 100);
      fill.style.width = percent + "%";
      fill.classList.toggle("error", !!error);
      $("pipe-progress-meta").textContent = complete + " of " + tasks.length + " stages complete";
      if (error) {
        $("pipe-progress-label").textContent = "Needs attention";
        $("pipe-progress-note").textContent = error.detail || error.title;
      } else if (running) {
        $("pipe-progress-label").textContent = "Running";
        $("pipe-progress-note").textContent = running.detail || running.title;
      } else if (complete === tasks.length) {
        $("pipe-progress-label").textContent = "Complete";
        $("pipe-progress-note").textContent = "All pipeline stages finished.";
      } else {
        $("pipe-progress-label").textContent = "Not started";
        $("pipe-progress-note").textContent = "Waiting for a run.";
      }
    }

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    async function inspectFile(file) {
      const fd = new FormData();
      fd.append("file", file);
      return j("/api/files/inspect", { method: "POST", body: fd });
    }

    async function populateFromFile(file, config) {
      if (!file) return "";
      const [text, meta] = await Promise.all([
        readFile(file),
        inspectFile(file).catch(() => ({ title: "", slug: "", article_url: "" }))
      ]);
      if (config.fileNameId) $(config.fileNameId).textContent = file.name;
      if (config.textId) $(config.textId).value = text;
      if (config.titleId && meta.title) $(config.titleId).value = meta.title;
      if (config.slugId && meta.slug) $(config.slugId).value = meta.slug;
      if (config.urlId && meta.article_url) $(config.urlId).value = meta.article_url;
      return text;
    }

    function clearPipe() {
      S.file = null;
      S.fileText = "";
      S.q = [];
      setRun("", "");
      S.runData.timestamp = null;
      S.runData.costUsd = null;
      S.mkSelected = null;
      $("article-title").value = "";
      $("article-slug").value = "";
      $("article-url").value = "";
      $("reflection-text").value = "";
      $("reflection-file").value = "";
      $("file-name").textContent = "";
      $("include-spanish").checked = true;

      $("include-thumbnail").checked = false;
      $("queue-social").checked = false;
      $("tone").value = "5";
      tone();
      pipelineSource("file");
      $("progress").innerHTML = '<div class="empty">No active run yet.</div>';
      $("results").classList.add("hide");
      $("sched-card").classList.add("hide");
      $("cost-badge").classList.add("hide");
      $("pipeline-cost").textContent = "Pipeline cost will appear here during the run.";
      $("cancel-pipe").style.display = "none";
      runChip(false);
      resetPipelineTasks();
      validPipe();
      updateRunMeta();
      renderMkReadingPane();
    }

    function startNewRun() {
      if (S.run) return;
      clearPipe();
      mode("pipeline");
      $("article-title").focus();
    }

    function step(msg, state) {
      const el = document.createElement("div");
      el.className = "progress-item";
      el.innerHTML = state === "done"
        ? '<span class="ok">OK</span><span>' + H(msg) + "</span>"
        : state === "error"
          ? '<span class="err">ERR</span><span>' + H(msg) + "</span>"
          : '<span class="spin"></span><span>' + H(msg) + "</span>";
      if (state !== "done" && state !== "error") S.q.push(el);
      if ($("progress").querySelector(".empty")) $("progress").innerHTML = "";
      $("progress").appendChild(el);
      if (state !== "done" && state !== "error") runChip(true, msg);
    }

    function doneStep(msg) {
      const el = S.q.shift();
      if (!el) {
        step(msg, "done");
        return;
      }
      el.innerHTML = '<span class="ok">OK</span><span>' + H(msg) + "</span>";
      runChip(true, msg);
    }

    function cost(tokens) {
      if (!tokens) return;
      const total = (((tokens.input_tokens || 0) + (tokens.output_tokens || 0)) / 1000).toFixed(1);
      const usd = typeof tokens.estimated_cost_usd === "number" ? tokens.estimated_cost_usd.toFixed(4) : "?";
      $("cost-badge").classList.remove("hide");
      $("cost-badge").textContent = "Cost $" + usd + " / " + total + "k tokens";
      $("pipeline-cost").textContent = "Pipeline cost $" + usd + " / " + total + "k tokens";
      S.runData.costUsd = tokens.estimated_cost_usd;
    }

    function setOpCost(id, usd, meta) {
      $(id).textContent = "$" + Number(usd || 0).toFixed(4) + (meta ? " / " + meta : "");
    }

    function animateMeter(id, timerKey, stop) {
      if (stop) {
        clearInterval(S[timerKey]);
        return;
      }
      let value = 0;
      $(id).style.width = "0%";
      clearInterval(S[timerKey]);
      S[timerKey] = setInterval(() => {
        if (value < 18) value += 5;
        else if (value < 56) value += 2;
        else if (value < 84) value += 1;
        $(id).style.width = Math.min(value, 90) + "%";
      }, 220);
    }

    function setRun(title, url) {
      S.runData = {
        title: title || "",
        url: url || "",
        reflectionEn: "",
        reflectionEs: "",
        companionTitle: "",
        companionEn: "",
        companionEs: "",
        socials: { reflection: { en: null, es: null }, companion: { en: null, es: null } },
        related: [],
        tags: [],
        quotes: [],
        runId: null
      };
      $("mk-cur").textContent = title ? "Loaded run: " + title + (url ? " / " + url : "") : "No run loaded yet.";
    }

    function seedPipelineReflection(text) {
      const value = String(text || "").trim();
      S.runData.reflectionEn = value;
      if (value) {
        renderRun();
        rt("reflection");
      } else if (!S.runData.reflectionEs && !S.runData.companionEn && !S.runData.companionEs && !S.runData.related.length) {
        $("results").classList.add("hide");
      }
    }

    function setMarketingTab(tab) {
      S.marketingTab = ["studio", "library", "notes", "quotes", "scheduled"].includes(tab) ? tab : "library";
      document.querySelectorAll("[data-mk-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.mkTab === S.marketingTab);
      });
      document.querySelectorAll(".marketing-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === "mk-pane-" + S.marketingTab);
      });
      if (S.marketingTab === "library") loadMk();
      if (S.marketingTab === "notes") loadSnBatches();
      if (S.marketingTab === "quotes") loadQuotesRuns();
      if (S.marketingTab === "scheduled") { loadScheduledQueue(); loadPublishedFeed(); }
    }

    function doc(id, text, name) {
      $(id).innerHTML = text
        ? '<div class="doc"><div class="doc-head"><strong>' + H(name || "document.md") + '</strong><div class="doc-actions"><div class="seg doc-switch"><button class="active" data-a="doc-view" data-view="code" data-id="' + id + '">Markdown</button><button data-a="doc-view" data-view="preview" data-id="' + id + '">Preview</button></div><button class="btn icon-btn" data-a="copy-doc" data-text="' + encodeURIComponent(text) + '" title="Copy" aria-label="Copy"><span class="icon-copy"></span></button><button class="btn" data-a="dl" data-text="' + encodeURIComponent(text) + '" data-file="' + encodeURIComponent(name || "document.md") + '">Download</button></div></div><div class="doc-surface" id="' + id + '-surface" data-view="code"><div class="doc-code"><pre>' + H(text) + '</pre></div><div class="doc-preview">' + renderMarkdown(text) + "</div></div></div>"
        : '<div class="empty">Nothing yet.</div>';
    }

    function rel(list) {
      S.runData.related = Array.isArray(list) ? list : [];
      $("related-out").innerHTML = S.runData.related.length
        ? '<div class="list">' + S.runData.related.map(article => (
          '<div class="entry"><div style="font-weight:800;margin-bottom:6px">' + H(article.title || "Untitled") + '</div>' +
          '<div class="muted" style="margin-bottom:8px">' + H(article.reason || "") + "</div>" +
          (article.url ? '<a href="' + H(article.url) + '" target="_blank" rel="noreferrer">' + H(article.url) + "</a>" : "") +
          "</div>"
        )).join("") + "</div>"
        : '<div class="empty">No related articles returned.</div>';
    }

    function social(scope, source, lang, data) {
      const keys = ["linkedin", "instagram", "threads", "substack_note"];
      const id = "soc-" + scope + "-" + source + "-" + lang;
      const payload = data || {};
      const hasAny = keys.some(k => payload[k]);
      const readonly = scope === "standalone" ? ' data-source="reflection"' : ' data-source="' + source + '"';
      const sourceLabel = source === "companion" ? "Companion" : "Reflection";

      if (!hasAny) {
        $(id).innerHTML = '<div class="empty">No social posts yet.</div>';
        return;
      }

      const SHORT = { linkedin: "LinkedIn", instagram: "Instagram", threads: "Threads", substack_note: "Substack Note" };

      const tabsHtml = '<div class="soc-tab-bar">' + keys.map((key, i) =>
        '<button class="soc-tab' + (i === 0 ? ' active' : '') + '" data-soc-tab="' + key + '" data-soc-id="' + id + '">' + (SHORT[key] || key) + '</button>'
      ).join("") + '</div>';

      const panelsHtml = keys.map((key, i) => {
        const textId = id + "-" + key;
        const canPublish = key !== "substack_note";
        const publishBtn = canPublish
          ? '<button class="btn" data-a="social-publish" data-platform="' + key + '" data-id="' + textId + '" data-label="' + H(PL[key] + ' / ' + lang.toUpperCase()) + '">Publish</button>'
          : "";
        const schedBtn = canPublish
          ? '<button class="btn" data-a="sched-open" data-picker="sched-pk-' + textId + '">Schedule</button>'
          : "";
        const regenBtn = scope !== "standalone"
          ? '<button class="btn" data-a="regen"' + readonly + ' data-lang="' + lang + '" data-platform="' + key + '">↺ Regen</button>'
          : "";

        const pickerHtml = canPublish
          ? '<div class="soc-schedule-picker" id="sched-pk-' + textId + '">' +
              '<label>Publish at</label>' +
              '<input type="datetime-local" id="sched-dt-' + textId + '">' +
              '<select class="sched-tz-sel" id="sched-tz-' + textId + '">' + tzOptionsHtml() + '</select>' +
              '<button class="btn" data-a="sched-confirm" data-platform="' + key + '" data-id="' + textId + '" data-label="' + H(PL[key] + ' / ' + lang.toUpperCase()) + '">Confirm</button>' +
              '<button class="ghost" data-a="sched-cancel" data-picker="sched-pk-' + textId + '">Cancel</button>' +
            '</div>'
          : "";

        const charLen = (payload[key] || "").length;
        const nearLimit = (key === "threads" && charLen > 450) || (key === "instagram" && charLen > 2100);

        return '<div class="soc-panel' + (i === 0 ? ' active' : '') + '" data-platform="' + key + '">' +
          '<div style="padding:14px 20px">' +
            '<textarea class="social-text" id="' + textId + '" data-soc-count="' + textId + '-count" data-soc-max="' + (key === "threads" ? 500 : key === "instagram" ? 2200 : key === "linkedin" ? 3000 : 0) + '">' + H(payload[key] || "") + '</textarea>' +
            (key === "instagram" ? schedInstagramImageHtml(textId, true) : "") +
            '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
              '<button class="btn" data-a="copy" data-id="' + textId + '">Copy</button>' +
              publishBtn + schedBtn + regenBtn +
              '<button class="btn" data-a="repurpose" data-id="' + textId + '"' + readonly + ' data-lang="' + lang + '" data-platform="' + key + '">Use as source</button>' +
            '</div>' +
            '<div class="soc-footer"><span class="char-count' + (nearLimit ? ' near-limit' : '') + '" id="' + textId + '-count">' + charLen + ' chars</span></div>' +
            pickerHtml +
          '</div>' +
        '</div>';
      }).join("");

      $(id).innerHTML = '<div class="soc-shell">' + tabsHtml + panelsHtml + '</div>';
      applyRoleUi($(id));
    }

    function syncSocial(source, lang, data) {
      S.runData.socials[source][lang] = data || null;
      social("pipe", source, lang, data);
      social("mk", source, lang, data);
    }

    function renderRun() {
      rel(S.runData.related);
      doc("ref-en", S.runData.reflectionEn, "reflection-" + slug(S.runData.title) + "-en.md");
      doc("ref-es", S.runData.reflectionEs, "reflection-" + slug(S.runData.title) + "-es.md");
      doc("comp-en", S.runData.companionEn, "companion-" + slug(S.runData.title) + "-en.md");
      doc("comp-es", S.runData.companionEs, "companion-" + slug(S.runData.title) + "-es.md");
      syncSocial("reflection", "en", S.runData.socials.reflection.en);
      syncSocial("reflection", "es", S.runData.socials.reflection.es);
      syncSocial("companion", "en", S.runData.socials.companion.en);
      syncSocial("companion", "es", S.runData.socials.companion.es);
      $("results").classList.remove("hide");
      $("mk-cur").textContent = S.runData.title ? "Loaded run: " + S.runData.title + (S.runData.url ? " / " + S.runData.url : "") : "No run loaded yet.";
      updateRunMeta();
      renderSubstackComposer();
    }

    function consume(data) {
      if (!data) return;
      if (Array.isArray(data.tags)) S.runData.tags = data.tags;
      if (Array.isArray(data.related_articles)) S.runData.related = data.related_articles;
      if (data.reflection) {
        S.runData.reflectionEn = data.reflection.en || S.runData.reflectionEn;
        S.runData.reflectionEs = data.reflection.es || S.runData.reflectionEs;
        if (data.reflection.repurposed_en) S.runData.socials.reflection.en = data.reflection.repurposed_en;
        if (data.reflection.repurposed_es) S.runData.socials.reflection.es = data.reflection.repurposed_es;
      }
      if (data.companion) {
        S.runData.companionTitle = data.companion.title || S.runData.companionTitle;
        S.runData.companionEn = data.companion.en || S.runData.companionEn;
        S.runData.companionEs = data.companion.es || S.runData.companionEs;
        if (data.companion.repurposed_en) S.runData.socials.companion.en = data.companion.repurposed_en;
        if (data.companion.repurposed_es) S.runData.socials.companion.es = data.companion.repurposed_es;
      }
      renderRun();
    }

    function renderQueueResults(data) {
      const out = [];
      let queuedCount = 0;
      Object.entries(data || {}).forEach(([section, value]) => {
        out.push('<div style="font-weight:800;margin:10px 0 5px">' + H(section) + "</div>");
        Object.entries(value || {}).forEach(([k, v]) => {
          const text = v && v.error ? v.error : v && v.skipped ? "skipped" : v && v.queued ? "queued" : "scheduled";
          if (v && v.queued) queuedCount += 1;
          out.push('<div class="muted" style="margin-bottom:6px">' + H(k + ": " + text) + "</div>");
        });
      });
      const summary = queuedCount
        ? '<div class="muted" style="margin-bottom:12px">Queued ' + queuedCount + ' posts into Marketing → Publishing.</div>'
        : "";
      $("sched-out").innerHTML = summary + (out.join("") || '<div class="empty">No schedule data.</div>');
      $("sched-card").classList.remove("hide");
      applyRoleUi($("sched-card"));
    }

    function setQueueCounts(count) {
      const value = Math.max(0, Number(count) || 0);
      if ($("sched-tab-count")) $("sched-tab-count").textContent = String(value);
      if ($("sched-header-count")) $("sched-header-count").textContent = value + " queued";
    }

    function pipeEvt(type, data) {
      if (type === "progress") {
        const message = data.message || "Working...";
        if (/related/i.test(message)) setTask("related", data.done ? "done" : "running", data.done ? "Done" : "Running", "Related articles", message);
        if (/translation|spanish reflection|reflection es/i.test(message)) setTask("reflection_es", data.done ? "done" : "running", data.done ? "Done" : "Running", "Reflection translation", message);
        if (/reflection.*social|socials for reflection/i.test(message)) setTask("reflection_social", data.done ? "done" : "running", data.done ? "Done" : "Running", "Reflection socials", message);
        if (/companion/i.test(message) && !/social/i.test(message)) setTask("companion", data.done ? "done" : "running", data.done ? "Done" : "Running", "Paid companion", message);
        if (/companion.*social/i.test(message)) setTask("companion_social", data.done ? "done" : "running", data.done ? "Done" : "Running", "Companion socials", message);
        if (/tag/i.test(message) && !/hashtag/i.test(message)) setTask("tagging", data.done ? "done" : "running", data.done ? "Done" : "Running", "Pillar tags", message);
        if (/quote/i.test(message)) setTask("quotes", data.done ? "done" : "running", data.done ? "Done" : "Running", "Quote extraction", message);
        data.done ? doneStep(message) : step(message, "run");
      } else if (type === "related_articles") {
        rel(data);
        setTask("related", "done", "Done", "Related articles", "Related article matches ready.");
      } else if (type === "reflection_es") {
        S.runData.reflectionEs = data.content || "";
        renderRun();
        setTask("reflection_es", "done", "Done", "Reflection translation", "Spanish reflection ready.");
      } else if (type === "companion_en") {
        S.runData.companionTitle = data.title || "";
        S.runData.companionEn = data.content || "";
        renderRun();
        if ($("include-spanish").checked) setTask("companion", "running", "Running", "Paid companion", "English companion ready. Finishing remaining companion work.");
        else setTask("companion", "done", "Done", "Paid companion", "English companion ready.");
      } else if (type === "companion_es") {
        S.runData.companionEs = data.content || "";
        renderRun();
        setTask("companion", "done", "Done", "Paid companion", "English and Spanish companion outputs ready.");
      } else if (type === "reflection_social_en") {
        syncSocial("reflection", "en", data);
        setTask("reflection_social", "running", "Running", "Reflection socials", "English reflection socials ready.");
      } else if (type === "reflection_social_es") {
        syncSocial("reflection", "es", data);
        setTask("reflection_social", "done", "Done", "Reflection socials", "English and Spanish reflection socials ready.");
      } else if (type === "companion_social_en") {
        syncSocial("companion", "en", data);
        setTask("companion_social", "running", "Running", "Companion socials", "English companion socials ready.");
      } else if (type === "companion_social_es") {
        syncSocial("companion", "es", data);
        setTask("companion_social", "done", "Done", "Companion socials", "English and Spanish companion socials ready.");
      } else if (type === "tags") {
        S.runData.tags = Array.isArray(data) ? data : [];
        setTask("tagging", "done", "Done", "Pillar tags", "Tags: " + (S.runData.tags.join(", ") || "none"));
        updateRunMeta();
      } else if (type === "quotes") {
        S.runData.quotes = Array.isArray(data) ? data : [];
        setTask("quotes", "done", "Done", "Quote extraction", S.runData.quotes.length + " quotes extracted.");
        renderPipeQuotes();
      } else if (type === "queue_results") {
        renderQueueResults(data);
      } else if (type === "run_pending") {
        S.runData.runId = data.run_id || null;
        updateRunMeta();
        upsertHistoryRun({
          id: data.run_id,
          timestamp: new Date().toISOString(),
          title: S.runData.title || $("article-title").value.trim() || "Untitled",
          article_url: S.runData.url || $("article-url").value.trim() || "",
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
          tags: Array.isArray(S.runData.tags) ? S.runData.tags.slice() : [],
          status: "running"
        });
        loadDash();
      } else if (type === "run_saved") {
        if (data.run_id) S.runData.runId = data.run_id;
        updateRunMeta();
        upsertHistoryRun({
          id: data.run_id || S.runData.runId,
          timestamp: S.runData.timestamp || S.runData.runStartTs || new Date().toISOString(),
          title: S.runData.title || $("article-title").value.trim() || "Untitled",
          article_url: S.runData.url || $("article-url").value.trim() || "",
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: Number(S.runData.costUsd || 0),
          tags: Array.isArray(S.runData.tags) ? S.runData.tags.slice() : [],
          status: "done"
        });
        loadDash();
      } else if (type === "save_error") {
        upsertHistoryRun({
          id: S.runData.runId,
          status: "error",
          cost_usd: Number(S.runData.costUsd || 0),
          tags: Array.isArray(S.runData.tags) ? S.runData.tags.slice() : []
        });
      } else if (type === "tokens") {
        cost(data);
        upsertHistoryRun({
          id: S.runData.runId,
          cost_usd: Number(data.estimated_cost_usd || 0),
          tokens_in: Number(data.input_tokens || 0),
          tokens_out: Number(data.output_tokens || 0),
          status: "running"
        });
      } else if (type === "result") {
        consume(data);
      } else if (type === "error") {
        step(data.message || "Pipeline error", "error");
        setTask("companion", "error", "Error", "Pipeline", data.message || "Pipeline error");
        upsertHistoryRun({
          id: S.runData.runId,
          status: "error",
          cost_usd: Number(S.runData.costUsd || 0),
          tags: Array.isArray(S.runData.tags) ? S.runData.tags.slice() : []
        });
      } else if (type === "cancelled") {
        upsertHistoryRun({
          id: S.runData.runId,
          status: "error",
          cost_usd: Number(S.runData.costUsd || 0),
          tags: Array.isArray(S.runData.tags) ? S.runData.tags.slice() : []
        });
        loadDash();
      } else if (type === "done") {
        runChip(false);
      }
    }

    async function runPipelineThumbnail(title, articleText) {
      if (!$("include-thumbnail").checked || !title || !articleText) {
        setTask("thumbnail", "skipped", "Skipped", "Thumbnail lane", "Thumbnail auto-run is disabled for this pipeline.");
        return;
      }
      setTask("thumbnail", "running", "Running", "Thumbnail lane", "Generating concepts and images in parallel.");
      S.thumbDraft = { concepts: [], review: false };
      $("th-title").value = title;
      if (!$("th-slug").value.trim()) $("th-slug").value = slug(title);
      $("th-text").value = articleText;
      $("th-status").textContent = "Pipeline auto-run: generating concepts and images...";
      $("th-images").classList.add("hide");
      thRender();
      await sse(fetch("/api/generate-thumbnail-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, article_text: articleText, auto_generate: true })
      }), (type, data) => {
        if (type === "concepts_ready") {
          S.thumbDraft.concepts = (data.concepts || []).map(item => Object.assign({}, item));
          thRender();
          $("th-status").textContent = "Pipeline auto-run: concepts ready, rendering images...";
          setTask("thumbnail", "running", "Running", "Thumbnail lane", "Concepts ready. Rendering images.");
        } else if (type === "concept_image") {
          const match = S.thumbDraft.concepts.find(item => Number(item.index) === Number(data.index));
          if (match) {
            match.image_b64 = data.image_b64 || "";
            match.revised_prompt = data.revised_prompt || "";
          }
          thRender();
        } else if (type === "image_cost") {
          $("th-status").textContent = "Pipeline auto-run: image cost $" + Number(data.cost_usd || 0).toFixed(4);
        } else if (type === "error") {
          $("th-status").textContent = data.message || "Thumbnail generation failed.";
          setTask("thumbnail", "error", "Error", "Thumbnail lane", data.message || "Thumbnail lane failed.");
        } else if (type === "done") {
          $("th-status").textContent = "Pipeline auto-run complete.";
          setTask("thumbnail", "done", "Done", "Thumbnail lane", "Concepts and rendered images are ready in the Thumbnail tab.");
        }
      });
    }

    async function runPipe() {
      const title = $("article-title").value.trim();
      const url = $("article-url").value.trim();
      let file = S.src === "file" ? S.file : null;
      let articleText = S.src === "file" ? S.fileText : $("reflection-text").value;
      if (!title) return;
      if (!file && S.src === "paste" && !articleText.trim()) return;
      if (S.src === "paste") {
        file = new File([new Blob([articleText], { type: "text/plain" })], "reflection.md", { type: "text/plain" });
      }
      setRun(title, url);
      S.runData.reflectionEn = String(articleText || "").trim();
      renderRun();
      rt("reflection");
      S.q = [];
      $("progress").innerHTML = "";
      $("results").classList.remove("hide");
      $("cancel-pipe").style.display = "block";
      $("run-pipe").disabled = true;
      $("sched-card").classList.add("hide");
      ["ref-en", "ref-es", "comp-en", "comp-es"].forEach(id => $(id).innerHTML = '<div class="empty">Waiting...</div>');
      $("pipe-quotes-out").innerHTML = '<div class="empty">Quotes will appear after the pipeline runs.</div>';
      // Reset Substack composer fields
      ["sub-title", "sub-subtitle", "sub-companion-tease"].forEach(id => { const el = $(id); if (el) el.value = ""; });
      const subPreview = $("sub-preview-body"); if (subPreview) subPreview.textContent = "Fill in the fields above and click Refresh to see the assembled post.";
      ["soc-pipe-reflection-en", "soc-pipe-reflection-es", "soc-pipe-companion-en", "soc-pipe-companion-es", "soc-mk-reflection-en", "soc-mk-reflection-es", "soc-mk-companion-en", "soc-mk-companion-es"].forEach(id => $(id).innerHTML = '<div class="empty">Waiting for social posts...</div>');
      resetPipelineTasks();
      S.runData.runStartTs = new Date().toISOString();
      runChip(true, "Pipeline running: " + title);
      const fd = new FormData();
      fd.append("reflection", file);
      fd.append("title", title);
      fd.append("article_url", url);
      fd.append("include_spanish", $("include-spanish").checked ? "true" : "false");
      fd.append("queue_social", $("queue-social").checked ? "true" : "false");
      fd.append("tone_level", $("tone").value);
      try {
        await Promise.all([
          sse(fetch("/api/pipeline/run", { method: "POST", body: fd }), pipeEvt),
          runPipelineThumbnail(title, articleText)
        ]);
        loadMk();
        loadHist();
        loadDash();
      } catch (e) {
        step(e.message || "Pipeline failed", "error");
      } finally {
        $("run-pipe").disabled = false;
        $("cancel-pipe").style.display = "none";
        runChip(false);
      }
    }

    async function loadCp() {
      try {
        const data = await j("/api/pipeline/checkpoint");
        if (!data.exists) {
          $("resume").classList.remove("show");
          return;
        }
        $("resume-meta").textContent = (data.title || "Untitled") + " - " + data.completed_steps.length + " of " + data.total_steps + " steps saved - " + dt(data.timestamp);
        $("resume").classList.add("show");
      } catch (e) {
        $("resume").classList.remove("show");
      }
    }

    async function resume() {
      try {
        $("resume").classList.remove("show");
        $("progress").innerHTML = "";
        $("results").classList.remove("hide");
        $("cancel-pipe").style.display = "block";
        $("run-pipe").disabled = true;
        resetPipelineTasks();
        const cp = await j("/api/pipeline/checkpoint");
        setRun(cp.title || "Resumed run", cp.article_url || "");
        runChip(true, "Pipeline running: " + S.runData.title);
        await sse(fetch("/api/pipeline/resume", { method: "POST" }), pipeEvt);
        loadMk();
        loadHist();
        loadDash();
      } catch (e) {
        step(e.message || "Resume failed", "error");
      } finally {
        $("run-pipe").disabled = false;
        $("cancel-pipe").style.display = "none";
        runChip(false);
      }
    }

    function coProg(start) {
      animateMeter("co-fill", "coTimer", !start);
    }

    async function runCo() {
      const title = $("co-title").value.trim();
      const text = $("co-text").value.trim();
      if (!title || !text) {
        $("co-status").textContent = "Title and reflection text are required.";
        return;
      }
      $("co-run").disabled = true;
      $("co-status").textContent = "Generating companion...";
      $("co-cost").textContent = "Companion generation cost will appear here.";
      coProg(true);
      try {
        const data = await j("/api/pipeline/companion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            text,
            article_url: $("co-url").value.trim(),
            include_spanish: $("co-spanish").checked
          })
        });
        doc("co-en", data.companion && data.companion.en, "companion-" + slug(title) + "-en.md");
        doc("co-es", data.companion && data.companion.es, "companion-" + slug(title) + "-es.md");
        cost(data.tokens);
        setOpCost("co-cost", data.tokens?.estimated_cost_usd || 0, ((((data.tokens?.input_tokens || 0) + (data.tokens?.output_tokens || 0)) / 1000).toFixed(1) + "k tokens"));
        $("co-status").textContent = "Done · " + ((((data.tokens?.input_tokens || 0) + (data.tokens?.output_tokens || 0)) / 1000).toFixed(1)) + "k tokens";
        $("co-fill").style.width = "100%";
      } catch (e) {
        $("co-status").textContent = e.message || "Companion generation failed.";
        $("co-fill").style.width = "0%";
      } finally {
        coProg(false);
        $("co-run").disabled = false;
      }
    }
