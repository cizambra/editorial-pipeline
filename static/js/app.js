    function mode(m) {
      S.mode = m;
      localStorage.setItem("ep_page", m);
      document.querySelectorAll(".page").forEach(node => node.classList.remove("active"));
      document.querySelectorAll(".nav").forEach(node => node.classList.toggle("active", node.dataset.mode === m));
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
      S.runData.reflectionEn = "";
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
      } else if (type === "tokens") {
        cost(data);
      } else if (type === "result") {
        consume(data);
      } else if (type === "error") {
        step(data.message || "Pipeline error", "error");
        setTask("companion", "error", "Error", "Pipeline", data.message || "Pipeline error");
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

    async function fetchMkUrl() {
      const url = $("mk-gen-url").value.trim();
      if (!url) { $("mk-gen-status").textContent = "Enter a URL first."; return; }
      $("mk-fetch-url").disabled = true;
      $("mk-gen-status").textContent = "Fetching article...";
      try {
        const data = await j("/api/articles/fetch?url=" + encodeURIComponent(url));
        if (data.title) { $("mk-gen-title").value = data.title; $("mk-gen-slug").value = slug(data.title); }
        if (data.markdown) $("mk-gen-text").value = data.markdown;
        $("mk-gen-status").textContent = "Article loaded. Review and generate.";
      } catch (e) {
        $("mk-gen-status").textContent = e.message || "Could not fetch article.";
      } finally {
        $("mk-fetch-url").disabled = false;
      }
    }

    async function runStandaloneMarketing() {
      const url = $("mk-gen-url").value.trim();
      let title = $("mk-gen-title").value.trim();
      let text = $("mk-gen-text").value.trim();

      // Auto-fetch if URL is given but text is empty
      if (url && !text) {
        await fetchMkUrl();
        title = $("mk-gen-title").value.trim();
        text = $("mk-gen-text").value.trim();
      }

      if (!title || !text) {
        $("mk-gen-status").textContent = "Paste a URL to fetch content, or fill in title and text manually.";
        return;
      }
      $("mk-gen-run").disabled = true;
      $("mk-gen-status").textContent = "Generating social campaign...";
      $("mk-gen-cost").textContent = "Standalone marketing cost will appear here.";
      animateMeter("mk-gen-fill", "mkTimer");
      try {
        const data = await j("/api/pipeline/repurpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            text,
            article_url: $("mk-gen-url").value.trim(),
            original_date: $("mk-gen-date").value.trim(),
            angle_note: $("mk-gen-angle").value.trim(),
            language: $("mk-gen-lang").value,
            tone_level: parseInt($("tone").value, 10) || 5,
            save_to_history: true
          })
        });
        const langKey = $("mk-gen-lang").value === "Spanish" ? "es" : "en";
        $("mk-standalone-out").innerHTML = '<div id="soc-standalone-reflection-' + langKey + '"></div>';
        social("standalone", "reflection", langKey, data.social || {});
        const node = $("soc-standalone-reflection-" + langKey);
        $("mk-standalone-out").innerHTML = node ? node.outerHTML : '<div class="empty">No social posts returned.</div>';
        cost(data.tokens);
        setOpCost("mk-gen-cost", data.tokens?.estimated_cost_usd || 0, ((((data.tokens?.input_tokens || 0) + (data.tokens?.output_tokens || 0)) / 1000).toFixed(1) + "k tokens"));
        $("mk-gen-status").textContent = "Done. Campaign saved to the library.";
        $("mk-gen-fill").style.width = "100%";
        loadMk();
        loadHist();
        loadDash();
      } catch (e) {
        $("mk-gen-status").textContent = e.message || "Standalone marketing generation failed.";
        $("mk-gen-fill").style.width = "0%";
      } finally {
        animateMeter("mk-gen-fill", "mkTimer", true);
        $("mk-gen-run").disabled = false;
      }
    }

    function view(scope) {
      if (!S.social[scope]) return;
      const current = S.social[scope];
      ["reflection", "companion"].forEach(source => ["en", "es"].forEach(lang => {
        const el = $("soc-" + scope + "-" + source + "-" + lang);
        if (el) el.classList.toggle("active", source === current.source && lang === current.lang);
      }));
      document.querySelectorAll('[data-scope="' + scope + '"]').forEach(button => {
        button.classList.toggle("active", button.dataset.val === S.social[scope][button.dataset.kind]);
      });
    }

    function renderMkReadingPane() {
      const el = $("mk-library-preview");
      if (!el) return;
      const title = S.runData.title || (S.mkSelected && S.mkSelected.title) || "";
      if (!title && !S.mkSelected) {
        el.innerHTML = '<div class="empty">Select a campaign to read its social posts.</div>';
        return;
      }
      const src = S.mkView.source;
      const lang = S.mkView.lang;
      const payload = (S.runData.socials[src] && S.runData.socials[src][lang]) || {};
      const runId = S.runData.runId || (S.mkSelected && S.mkSelected.id);
      const url = S.runData.url || (S.mkSelected && S.mkSelected.article_url) || "";
      const cost = S.runData.costUsd || (S.mkSelected && S.mkSelected.cost_usd) || 0;

      const assets = [];
      ["reflection", "companion"].forEach(s => {
        ["en", "es"].forEach(l => {
          const d = S.runData.socials[s] && S.runData.socials[s][l];
          if (d && Object.values(d).some(v => v)) {
            assets.push({ source: s, lang: l, label: (s === "reflection" ? "Reflection" : "Companion") + " " + l.toUpperCase() });
          }
        });
      });

      const pillsHtml = assets.length > 1
        ? '<div class="mk-asset-pills">' + assets.map(a =>
            '<button class="mk-asset-pill' + (a.source === src && a.lang === lang ? ' active' : '') +
            '" data-mk-src="' + a.source + '" data-mk-lang="' + a.lang + '">' + H(a.label) + '</button>'
          ).join("") + '</div>'
        : "";

      const platforms = [
        { key: "linkedin",      label: "LinkedIn",     canPublish: true  },
        { key: "threads",       label: "Threads",      canPublish: true  },
        { key: "instagram",     label: "Instagram",    canPublish: false },
        { key: "substack_note", label: "Substack Note",canPublish: true  },
      ];

      const activePlatforms = platforms.filter(p => (payload[p.key] || "").trim());

      const headerHtml =
        '<div class="mk-reading-header">' +
          '<div style="min-width:0">' +
            '<div class="mk-reading-title">' + H(title || "Untitled") + '</div>' +
            '<div class="mk-reading-sub">' +
              (url ? '<span class="muted" style="font-size:11px">' + H(url) + '</span>' : '') +
              (url && cost ? '<span class="muted" style="font-size:11px;margin:0 6px">·</span>' : '') +
              (cost ? '<span class="muted" style="font-size:11px">$' + H(Number(cost).toFixed(4)) + '</span>' : '') +
            '</div>' +
          '</div>' +
          (runId ? '<button class="btn" style="white-space:nowrap;flex-shrink:0" data-a="open-run" data-id="' + runId + '" data-mode="pipeline">View run ↗</button>' : '') +
        '</div>';

      if (!activePlatforms.length) {
        el.innerHTML = headerHtml + pillsHtml + '<div class="empty">No social posts for this selection.</div>';
        return;
      }

      const tabBarHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--line);margin-top:14px">' +
        activePlatforms.map((p, i) =>
          '<button class="sn-plat-btn' + (i === 0 ? ' active' : '') + '" data-a="mk-plat-tab" data-plat="' + p.key + '">' + p.label + '</button>'
        ).join("") +
      '</div>';

      const panelsHtml = activePlatforms.map((p, i) => {
        const raw = payload[p.key] || "";
        const posts = raw.split(/\n\s*---+\s*\n/g).map(t => t.trim()).filter(Boolean);
        const textId = "mk-read-" + p.key;
        const multi = posts.length > 1;
        const isSub = p.key === "substack_note";

        const navHtml = multi
          ? '<div class="mk-carousel-nav" style="margin-bottom:8px">' +
              '<button class="mk-nav-btn" data-nav-id="' + textId + '" data-dir="-1" disabled>&#8592;</button>' +
              '<span class="mk-carousel-counter" id="' + textId + '-counter">1 / ' + posts.length + '</span>' +
              '<button class="mk-nav-btn" data-nav-id="' + textId + '" data-dir="1">&#8594;</button>' +
              '<span class="muted" style="font-size:11px">' + posts.length + ' variants</span>' +
            '</div>'
          : '';

        const contentHtml = isSub
          ? '<div class="rte-wrap">' +
              '<div class="rte-toolbar">' +
                '<button class="rte-btn" data-rte-cmd="bold" title="Bold"><b>B</b></button>' +
                '<button class="rte-btn" data-rte-cmd="italic" title="Italic"><i>I</i></button>' +
                '<div class="rte-sep"></div>' +
                '<button class="rte-btn" data-rte-cmd="insertUnorderedList" title="Bullet list" style="font-size:15px">&#8226;&#8801;</button>' +
                '<div class="rte-sep"></div>' +
                '<button class="rte-btn" data-rte-cmd="createLink" title="Insert link" style="font-size:11px;font-weight:400">&#128279;</button>' +
                '<button class="rte-btn" data-rte-cmd="unlink" title="Remove link" style="font-size:11px;font-weight:400;opacity:0.6">&#10007;</button>' +
                '<div class="rte-sep"></div>' +
                '<button class="rte-btn" data-rte-cmd="removeFormat" title="Clear formatting" style="font-size:10px;font-weight:400">Tx</button>' +
              '</div>' +
              '<div class="rte-body" id="' + textId + '" contenteditable="true">' + renderMarkdown(posts[0]) + '</div>' +
            '</div>'
          : '<textarea class="social-text" id="' + textId + '">' + H(posts[0]) + '</textarea>' +
            (p.key === "instagram" ? schedInstagramImageHtml(textId, true) : "");

        const actionsHtml =
          '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
            '<button class="btn" data-a="copy" data-id="' + textId + '">Copy</button>' +
            (p.canPublish ? '<button class="btn" data-a="social-publish" data-platform="' + p.key + '" data-id="' + textId + '" data-label="' + H(p.label) + '">Publish</button>' : '') +
            (p.canPublish ? '<button class="btn" data-a="sched-open" data-picker="sched-pk-' + textId + '">Schedule</button>' : '') +
          '</div>' +
          (p.canPublish
            ? '<div class="soc-schedule-picker" id="sched-pk-' + textId + '">' +
                '<label>Publish at</label>' +
                '<input type="datetime-local" id="sched-dt-' + textId + '">' +
                '<select class="sched-tz-sel" id="sched-tz-' + textId + '">' + tzOptionsHtml() + '</select>' +
                '<button class="btn" data-a="sched-confirm" data-platform="' + p.key + '" data-id="' + textId + '" data-label="' + H(p.label) + '">Confirm</button>' +
                '<button class="ghost" data-a="sched-cancel" data-picker="sched-pk-' + textId + '">Cancel</button>' +
              '</div>'
            : '');

        return '<div class="sn-plat-panel' + (i === 0 ? ' active' : '') + '" ' +
          'id="' + textId + '-section" data-plat="' + p.key + '" ' +
          (multi ? 'data-posts=\'' + JSON.stringify(posts).replace(/'/g, "&#39;") + '\' data-idx="0" ' : '') +
          'style="padding:14px 0 4px">' +
          navHtml + contentHtml + actionsHtml +
        '</div>';
      }).join("");

      el.innerHTML = headerHtml + pillsHtml + tabBarHtml + panelsHtml;
    }

    function renderMarketingPreview(run) {
      $("mk-library-preview").innerHTML = run
        ? '<div class="marketing-preview-card">' +
          '<div class="marketing-preview-meta">' +
          '<div class="section-title">' + H(run.title || "Untitled") + '</div>' +
          '<div class="muted">' + H(dt(run.timestamp)) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<span class="tag">' + H(String(run.post_count || 0) + " posts") + '</span>' +
          '<span class="tag">' + H(String(run.asset_count || 0) + " assets") + '</span>' +
          '<span class="tag">$' + H(Number(run.cost_usd || 0).toFixed(4)) + '</span>' +
          '</div>' +
          (run.article_url ? '<div class="marketing-run-url">' + H(run.article_url) + '</div>' : '<div class="marketing-run-url">No article URL</div>') +
          '</div>' +
          ((run.assets || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + run.assets.map(asset => '<span class="tag">' + H(asset.label || "") + '</span>').join("") + '</div>' : "") +
          '<div class="marketing-preview-actions">' +
          '<button class="btn" data-a="open-run" data-id="' + run.id + '" data-mode="marketing">Open socials</button>' +
          '<button class="ghost" data-a="open-run" data-id="' + run.id + '" data-mode="pipeline">Open run</button>' +
          '</div>' +
          '</div>'
        : '<div class="empty">Select a saved campaign to inspect it here.</div>';
    }

    function selectMarketingRun(id) {
      S.mkSelected = S.mk.find(run => String(run.id) === String(id)) || null;
      mkRender();
      if (S.mkSelected) {
        j("/api/history/" + id).then(run => {
          setRun(run.title || "", run.article_url || "");
          S.runData.runId = run.id;
          S.runData.timestamp = run.timestamp || null;
          S.runData.costUsd = run.cost_usd || 0;
          consume(run.data || {});
          S.mkView = { source: "reflection", lang: "en" };
          renderMkReadingPane();
        }).catch(() => renderMkReadingPane());
      }
    }

    function mkRender() {
      const query = $("mk-search").value.trim().toLowerCase();
      const rows = S.mk.filter(run => !query || (run.title || "").toLowerCase().includes(query) || (run.article_url || "").toLowerCase().includes(query));
      if (!rows.length) {
        S.mkSelected = null;
      } else if (!S.mkSelected || !rows.some(run => String(run.id) === String(S.mkSelected.id))) {
        S.mkSelected = rows[0];
      }
      $("mk-library-count").textContent = rows.length + (rows.length === 1 ? " campaign" : " campaigns");
      $("mk-library-note").textContent = rows.length ? "Search by article title or URL." : "No campaigns match the current search.";
      $("mk-list").innerHTML = rows.length
        ? rows.map(run => (
          '<button class="marketing-run' + (S.mkSelected && String(S.mkSelected.id) === String(run.id) ? ' active' : '') + '" data-a="mk-select" data-id="' + run.id + '">' +
          '<div class="marketing-run-top"><div><div class="marketing-run-title">' + H(run.title || "Untitled") + '</div><div class="marketing-run-sub">' + timeAgo(run.timestamp) + '</div></div>' +
          '<div style="display:flex;gap:4px;align-items:center">' +
          '<span style="font-size:10px;font-weight:600;color:var(--muted);letter-spacing:0.04em">' + H(String(run.post_count || 0) + " posts") + "</span>" +
          (run.cost_usd ? '<span style="font-size:10px;font-weight:600;color:var(--muted);letter-spacing:0.04em">$' + H((run.cost_usd || 0).toFixed(4)) + "</span>" : "") +
          '</div></div>' +
          '<div class="marketing-run-url">' + H(run.article_url || "No article URL") + "</div></button>"
        )).join("")
        : '<div class="empty">No marketing runs found.</div>';
      renderMkReadingPane();
    }

    async function loadMk() {
      $("mk-list").innerHTML = '<div class="empty">Loading previous social runs...</div>';
      try {
        const data = await j("/api/marketing/library");
        S.mk = data.runs || [];
        mkRender();
      } catch (e) {
        $("mk-list").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
      }
    }

    function markStagesFromData(data) {
      const d = data || {};
      const r = d.reflection || {};
      const c = d.companion || {};
      const s = (key, ok) => setTask(key, ok ? "done" : "skipped", ok ? "Done" : "Skipped", "", "");
      s("related", Array.isArray(d.related_articles) && d.related_articles.length > 0);
      s("reflection_es", !!r.es);
      s("reflection_social", !!(r.repurposed_en || r.repurposed_es));
      s("companion", !!(c.en || c.es));
      s("companion_social", !!(c.repurposed_en || c.repurposed_es));
      setTask("thumbnail", "skipped", "Skipped", "Thumbnail lane", "");
      s("tagging", Array.isArray(d.tags) && d.tags.length > 0);
    }

    async function openRun(id, targetMode) {
      const run = await j("/api/history/" + id);
      setRun(run.title || "", run.article_url || "");
      S.runData.runId = run.id;
      S.runData.timestamp = run.timestamp || null;
      S.runData.costUsd = run.cost_usd || 0;
      consume(run.data || {});
      markStagesFromData(run.data || {});
      cost({ input_tokens: run.tokens_in || 0, output_tokens: run.tokens_out || 0, estimated_cost_usd: run.cost_usd || 0 });
      mode(targetMode || "pipeline");
      if ((targetMode || "pipeline") === "marketing") {
        setMarketingTab("library");
        S.mkView = { source: "reflection", lang: "en" };
        renderMkReadingPane();
        S.mkSelected = S.mk.find(r => String(r.id) === String(run.id)) || null;
        mkRender();
      }
      updateRunMeta();
    }

    function histRender() {
      $("hist-list").innerHTML = S.hist.length
        ? S.hist.map(run => {
          const runTags = (run.tags && typeof run.tags === "string") ? run.tags.split(",").map(t => t.trim()).filter(Boolean) : (Array.isArray(run.tags) ? run.tags : []);
          const tagsHtml = runTags.map(t => '<span class="tag">' + H(t) + '</span>').join("");
          return '<div class="entry-item">' +
            '<div class="between" style="margin-bottom:6px">' +
              '<div><div style="font-weight:700;font-size:13px">' + H(run.title || "Untitled") + '</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px;align-items:center">' +
                '<span style="font-size:11px;color:var(--muted)">' + timeAgo(run.timestamp) + '</span>' +
                '<span class="tag">$' + H((run.cost_usd || 0).toFixed(4)) + '</span>' +
                '<span class="tag">' + H((((run.tokens_in || 0) + (run.tokens_out || 0)) / 1000).toFixed(1) + "k tokens") + '</span>' +
                tagsHtml +
              '</div></div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button class="btn" data-a="open-run" data-id="' + run.id + '" data-mode="pipeline">Open</button>' +
                '<button class="ghost" data-a="del-run" data-id="' + run.id + '">Delete</button>' +
              '</div>' +
            '</div>' +
            '<div class="muted" style="font-size:11px">' + H(run.article_url || "No article URL") + '</div>' +
          '</div>';
        }).join("")
        : '<div class="empty">No runs yet.</div>';
    }

    async function loadHist() {
      $("hist-list").innerHTML = '<div class="empty">Loading run history...</div>';
      try {
        const data = await j("/api/history");
        S.hist = data.runs || [];
        histRender();
      } catch (e) {
        $("hist-list").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
      }
    }

    function parseIdeaSampleUrls(rawValue) {
      if (!rawValue) return [];
      if (Array.isArray(rawValue)) return rawValue.filter(Boolean);
      if (typeof rawValue !== "string") return [];
      try {
        const parsed = JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (_err) {
        return rawValue ? [rawValue] : [];
      }
    }

    function renderIdeaSampleLinks(idea) {
      const sampleUrls = parseIdeaSampleUrls(idea.sample_urls).slice(0, 3);
      if (!sampleUrls.length) return "";
      return '<div class="muted" style="margin-top:10px;font-size:12px">' +
        '<span style="margin-right:8px">Sample posts:</span>' +
        sampleUrls.map((url, index) =>
          '<a href="' + H(url) + '" target="_blank" rel="noopener noreferrer" ' +
          'style="color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb, var(--accent) 35%, transparent);margin-right:10px">' +
          'Post ' + (index + 1) +
          "</a>"
        ).join("") +
      "</div>";
    }

    function ideasRender() {
      const statusBorderColor = { new: "var(--line-strong)", writing: "var(--accent)", done: "var(--ok)" };
      $("ideas-list").innerHTML = S.ideas.length
        ? S.ideas.map(idea => {
          const status = idea.status || "new";
          const borderColor = statusBorderColor[status] || "var(--line-strong)";
          return '<div class="idea" style="border-left:4px solid ' + borderColor + '">' +
            '<div class="between">' +
              '<div>' +
                '<div style="font-weight:700;font-size:14px">' + H((idea.emoji || "✦") + " " + (idea.theme || "")) + '</div>' +
                '<div class="muted" style="margin-top:3px;font-size:12px">' + H((idea.category || "uncategorized") + (idea.article_angle ? " — " + idea.article_angle : "")) + '</div>' +
              '</div>' +
              '<span class="tag" style="text-transform:capitalize">' + H(status) + '</span>' +
            '</div>' +
            renderIdeaSampleLinks(idea) +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
              '<button class="btn" data-a="idea-status" data-id="' + idea.id + '" data-status="new">New</button>' +
              '<button class="btn" data-a="idea-status" data-id="' + idea.id + '" data-status="writing">Writing</button>' +
              '<button class="btn" data-a="idea-status" data-id="' + idea.id + '" data-status="done">Done</button>' +
              '<button class="btn" data-a="idea-pipeline" data-id="' + idea.id + '">→ Pipeline</button>' +
              '<button class="btn" data-a="idea-write" data-id="' + idea.id + '">Send to marketing</button>' +
              '<button class="ghost" data-a="idea-del" data-id="' + idea.id + '">Delete</button>' +
            '</div>' +
          '</div>';
        }).join("")
        : '<div class="empty">No ideas yet.</div>';
    }

    async function loadIdeas() {
      $("ideas-list").innerHTML = '<div class="empty">Loading ideas...</div>';
      try {
        const data = await j("/api/ideas");
        S.ideas = data.ideas || [];
        ideasRender();
      } catch (e) {
        $("ideas-list").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
      }
    }

    async function saveIdea() {
      const theme = $("idea-theme").value.trim();
      if (!theme) {
        $("idea-status").textContent = "Theme is required.";
        return;
      }
      await j("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          category: $("idea-cat").value.trim(),
          emoji: $("idea-emoji").value.trim() || "*",
          article_angle: $("idea-angle").value.trim(),
          source: "manual"
        })
      });
      $("idea-status").textContent = "Saved.";
      $("idea-theme").value = "";
      $("idea-cat").value = "";
      $("idea-angle").value = "";
      loadIdeas();
    }

    // --- Substack Notes -------------------------------------------------------

    const SN_INTENT_CLASS = {
      "CDT": "cdt",
      "Metaphor": "metaphor",
      "Practice (Kata)": "practice",
      "Education": "education",
      "Positive Alignment": "alignment",
      "Reflection": "reflection",
      "Validation": "reflection",
      "Universal Model (A/B/C)": "model",
      "Universal Model": "model",
    };

    function snIntentClass(intent) {
      return SN_INTENT_CLASS[intent] || "";
    }

    // === SOCIAL WORKSPACE ===

    function snShowPanel(mode) {
      S.snMode = mode;
      $("sn-detail-empty").style.display = mode === "empty" ? "" : "none";
      $("sn-compose-pane").style.display = mode === "compose" ? "" : "none";
      $("sn-note-detail").style.display = mode === "note" ? "" : "none";
    }

    function _snBatchNotesListHtml(batchId, notes) {
      if (!notes.length) return '<div style="padding:10px 14px;font-size:12px;color:var(--muted)">No notes in this batch.</div>';
      const SHOW = 3;
      const showAll = S.snBatchShowAll[batchId];
      const display = showAll ? notes : notes.slice(0, SHOW);
      let html = display.map(n => {
        const cls = snIntentClass(n.intent);
        const isActive = S.snSelectedNote && String(S.snSelectedNote.id) === String(n.id);
        return '<button class="sn-batch-note-item' + (isActive ? ' active' : '') + '" data-a="sn-note-open" data-bid="' + batchId + '" data-nid="' + n.id + '">' +
          '<span class="tag sn-intent ' + cls + '" style="flex-shrink:0">' + H(n.intent) + '</span>' +
          '<span class="sn-batch-note-label">' + H(n.issue) + '</span>' +
        '</button>';
      }).join("");
      if (!showAll && notes.length > SHOW) {
        html += '<button class="sn-batch-more" data-a="sn-batch-show-all" data-bid="' + batchId + '">+ ' + (notes.length - SHOW) + ' more</button>';
      }
      return html;
    }

    function snSearchActive() {
      return !!(S.snSearch.q || S.snSearch.shared || S.snSearch.repurposed || S.snSearch.signal);
    }

    function snSearchRender() {
      const el = $("sn-batch-rail");
      if (!el) return;
      const notes = S.snSearchResults;
      if (!notes.length) {
        el.innerHTML = '<div class="empty" style="padding:16px 0">No notes match.</div>';
        return;
      }
      el.innerHTML =
        '<div style="font-size:11px;color:var(--muted);padding:4px 0 8px">' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + ' found</div>' +
        notes.map(n => {
          const cls = snIntentClass(n.intent);
          const isActive = S.snSelectedNote && String(S.snSelectedNote.id) === String(n.id);
          const badges = [
            n.shared ? '<span title="Shared" style="color:var(--accent)">●</span>' : '',
            (n.linkedin_post || n.threads_post || n.instagram_post) ? '<span title="Cross-posted" style="color:var(--muted)">↗</span>' : '',
            n.signal === 'positive' ? '👍' : n.signal === 'negative' ? '👎' : ''
          ].filter(Boolean).join('');
          return '<button class="sn-batch-note-item' + (isActive ? ' active' : '') + '" data-a="sn-note-open" data-bid="' + n.batch_id + '" data-nid="' + n.id + '">' +
            '<span class="tag sn-intent ' + cls + '" style="flex-shrink:0">' + H(n.intent) + '</span>' +
            '<span class="sn-batch-note-label">' + H(n.issue) + '</span>' +
            (badges ? '<span style="font-size:11px;flex-shrink:0">' + badges + '</span>' : '') +
          '</button>';
        }).join("");
    }

    async function snDoSearch() {
      if (!snSearchActive()) {
        snBatchRailRender();
        return;
      }
      const el = $("sn-batch-rail");
      if (el) el.innerHTML = '<div style="padding:8px 0;font-size:12px;color:var(--muted)">Searching…</div>';
      try {
        const params = new URLSearchParams();
        if (S.snSearch.q)        params.set("q", S.snSearch.q);
        if (S.snSearch.shared)   params.set("shared", "1");
        if (S.snSearch.repurposed) params.set("repurposed", "1");
        if (S.snSearch.signal)   params.set("signal", S.snSearch.signal);
        const data = await j("/api/substack-notes/search?" + params.toString());
        S.snSearchResults = data.notes || [];
        snSearchRender();
      } catch (e) {
        if (el) el.innerHTML = '<div class="empty" style="padding:16px 0">Search failed.</div>';
      }
    }

    function snBatchRailRender() {
      if (snSearchActive()) { snDoSearch(); return; }
      const el = $("sn-batch-rail");
      if (!S.snBatches.length) {
        el.innerHTML = '<div class="empty" style="padding:16px 0">No batches yet.</div>';
        return;
      }
      el.innerHTML = S.snBatches.map(b => {
        const isOpen = !!S.snOpenBatches[b.id];
        const notes = S.snBatchNotesCache[b.id] || [];
        const notesHtml = isOpen
          ? (notes.length ? _snBatchNotesListHtml(b.id, notes) : '<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Loading…</div>')
          : "";
        return '<div class="sn-batch-entry" data-bid="' + b.id + '">' +
          '<div class="sn-batch-head' + (isOpen ? ' open' : '') + '" data-a="sn-batch-toggle" data-bid="' + b.id + '">' +
            '<span class="sn-batch-head-title">Batch #' + H(b.id) + ' &mdash; ' + timeAgo(b.timestamp) + '</span>' +
            '<span style="font-size:11px;color:var(--muted)">' + (b.note_count || 0) + '</span>' +
            '<button class="sn-batch-del" data-a="sn-batch-del" data-bid="' + b.id + '" title="Delete batch">&times;</button>' +
          '</div>' +
          '<div class="sn-batch-notes' + (isOpen ? ' open' : '') + '" id="sn-batch-notes-' + b.id + '">' + notesHtml + '</div>' +
        '</div>';
      }).join("");
    }

    function snOpenNote(note) {
      S.snSelectedNote = note;
      document.querySelectorAll(".sn-batch-note-item").forEach(el => {
        el.classList.toggle("active", el.dataset.nid === String(note.id));
      });
      snShowPanel("note");
      snNoteDetailRender();
    }

    function _snRteHtml(id, htmlContent) {
      return '<div class="rte-wrap">' +
        '<div class="rte-toolbar">' +
          '<button class="rte-btn" data-rte-cmd="bold" title="Bold"><b>B</b></button>' +
          '<button class="rte-btn" data-rte-cmd="italic" title="Italic"><i>I</i></button>' +
          '<div class="rte-sep"></div>' +
          '<button class="rte-btn" data-rte-cmd="insertUnorderedList" title="Bullet list" style="font-size:15px">&#8226;&#8801;</button>' +
          '<div class="rte-sep"></div>' +
          '<button class="rte-btn" data-rte-cmd="createLink" title="Link" style="font-size:11px;font-weight:400">&#128279;</button>' +
          '<button class="rte-btn" data-rte-cmd="unlink" title="Remove link" style="font-size:11px;font-weight:400;opacity:0.6">&#10007;</button>' +
          '<div class="rte-sep"></div>' +
          '<button class="rte-btn" data-rte-cmd="removeFormat" title="Clear formatting" style="font-size:10px;font-weight:400">Tx</button>' +
        '</div>' +
        '<div class="rte-body" id="' + id + '" contenteditable="true">' + (htmlContent || '') + '</div>' +
      '</div>';
    }

    function _snPlatActionsHtml(textId, platform, label, saveNid) {
      const saveBtn = saveNid
        ? '<button class="btn" data-a="sn-note-save" data-nid="' + saveNid + '" data-text-id="' + textId + '">Save</button>'
        : '';
      return '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
        '<button class="btn" data-a="copy" data-id="' + textId + '">Copy</button>' +
        '<button class="btn" data-a="social-publish" data-platform="' + platform + '" data-id="' + textId + '">Publish</button>' +
        '<button class="btn" data-a="sched-open" data-picker="sched-pk-' + textId + '">Schedule</button>' +
        saveBtn +
      '</div>' +
      '<div class="soc-schedule-picker" id="sched-pk-' + textId + '">' +
        '<label>Publish at</label>' +
        '<input type="datetime-local" id="sched-dt-' + textId + '">' +
        '<select class="sched-tz-sel" id="sched-tz-' + textId + '">' + tzOptionsHtml() + '</select>' +
        '<button class="btn" data-a="sched-confirm" data-platform="' + platform + '" data-id="' + textId + '" data-label="' + H(label) + '">Confirm</button>' +
        '<button class="ghost" data-a="sched-cancel" data-picker="sched-pk-' + textId + '">Cancel</button>' +
        (platform === "instagram" ? schedInstagramImageHtml(textId, true) : '') +
      '</div>';
    }

    function _snSchedAllHtml(panelId, platforms, noteId) {
      const pills = platforms.map(p =>
        '<button class="sn-plat-btn active" data-a="sn-sa-toggle" data-panel="' + panelId + '" data-plat="' + p.key + '" data-text-id="' + p.textId + '">' + p.label + '</button>'
      ).join("");
      return '<div class="sn-sched-all-panel" id="' + panelId + '"' + (noteId ? ' data-note-id="' + noteId + '"' : '') + '>' +
        '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Schedule all at once</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
          '<input type="datetime-local" class="sn-sa-dt" id="' + panelId + '-dt" style="flex:1;min-width:160px">' +
          '<select class="sched-tz-sel sn-sa-tz" id="' + panelId + '-tz">' + tzOptionsHtml() + '</select>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + pills + '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn pri" data-a="sn-sa-confirm" data-panel="' + panelId + '">Schedule selected</button>' +
          '<button class="ghost" data-a="sn-sa-cancel" data-panel="' + panelId + '">Cancel</button>' +
        '</div>' +
      '</div>';
    }

    function snNoteDetailRender() {
      const note = S.snSelectedNote;
      if (!note) return;
      const pane = $("sn-note-detail");
      if (!pane) return;
      const sigPos = note.signal === "positive";
      const sigNeg = note.signal === "negative";
      const cls = snIntentClass(note.intent);

      const platforms = [
        { key: "substack_note", label: "Substack Note ●", text: note.note_text },
        { key: "linkedin",      label: "LinkedIn",         text: note.linkedin_post || "" },
        { key: "threads",       label: "Threads",          text: note.threads_post  || "" },
        { key: "instagram",     label: "Instagram",        text: note.instagram_post || "" },
      ];

      const platBar = '<div class="sn-plat-bar">' +
        platforms.map((p, i) =>
          '<button class="sn-plat-btn' + (i === 0 ? ' active' : '') + '" data-a="sn-plat-tab" data-plat="' + p.key + '" data-nid="' + note.id + '">' + p.label + '</button>'
        ).join("") +
      '</div>';

      const hasRepurpose = !!(note.linkedin_post || note.threads_post || note.instagram_post);

      const panelsHtml = platforms.map((p, i) => {
        const textId = "sn-det-" + note.id + "-" + p.key;
        const isEmpty = p.key !== "substack_note" && !p.text;
        // SN panel gets inline Save; other empty panels get a Generate button
        const saveNid = p.key === "substack_note" ? note.id : null;
        const isSN = p.key === "substack_note";
        return '<div class="sn-plat-panel' + (i === 0 ? ' active' : '') + '" id="sn-det-panel-' + note.id + '-' + p.key + '">' +
          (isEmpty
            ? '<div class="empty" style="padding:20px 0;text-align:center">' +
                '<div style="color:var(--muted);margin-bottom:10px">Not cross-posted yet.</div>' +
                '<button class="btn" data-a="sn-repurpose" data-id="' + note.id + '">Cross-post all →</button>' +
              '</div>'
            : (isSN
                ? _snRteHtml(textId, renderMarkdown(p.text))
                : '<textarea class="sn-det-ta" id="' + textId + '">' + H(p.text) + '</textarea>'
              ) +
              _snPlatActionsHtml(textId, p.key, PL[p.key] || p.key, saveNid)
          ) +
        '</div>';
      }).join("");

      const saId = "sn-sa-" + note.id;
      const saPlatforms = platforms
        .filter(p => p.text)
        .map(p => ({ key: p.key, label: p.label.replace(" ●", ""), textId: "sn-det-" + note.id + "-" + p.key }));

      const actionsStrip =
        '<div class="sn-note-actions-strip">' +
          '<button class="btn' + (note.shared ? ' ok' : '') + '" data-a="sn-shared" data-id="' + note.id + '" data-val="' + (note.shared ? '0' : '1') + '">' + (note.shared ? '✓ Shared' : 'Mark shared') + '</button>' +
          '<button class="btn' + (sigPos ? ' ok' : '') + '" data-a="sn-signal" data-id="' + note.id + '" data-val="positive">👍</button>' +
          '<button class="btn' + (sigNeg ? ' danger' : '') + '" data-a="sn-signal" data-id="' + note.id + '" data-val="negative">👎</button>' +
          (sigPos ? '<button class="btn" data-a="sn-promote" data-id="' + note.id + '">→ Ideas</button>' : '') +
          '<button class="btn" data-a="sn-repurpose" data-id="' + note.id + '">' + (hasRepurpose ? 'Cross-post ✓' : 'Cross-post →') + '</button>' +
          '<button class="btn" data-a="sn-rep-thumb" data-nid="' + note.id + '" data-issue="' + encodeURIComponent(note.issue) + '">Thumbnail →</button>' +
          (hasRepurpose ? '<button class="btn" data-a="sn-sa-open" data-panel="' + saId + '" style="margin-left:auto">Schedule all →</button>' : '') +
        '</div>';

      pane.innerHTML =
        '<div class="card-head" style="padding:14px 20px;border-bottom:1px solid var(--line);margin-bottom:0">' +
          '<div style="flex:1">' +
            '<span class="tag sn-intent ' + cls + '">' + H(note.intent) + '</span>' +
            '<div style="font-weight:700;font-size:13px;margin-top:5px">' + H(note.issue) + '</div>' +
          '</div>' +
        '</div>' +
        platBar +
        panelsHtml +
        actionsStrip +
        (hasRepurpose ? _snSchedAllHtml(saId, saPlatforms, note.id) : '');
    }

    function snNewPost() {
      S.snMode = "compose";
      S.compose.repurpose = null;
      S.compose.platform = "substack_note";
      S.compose.texts = { linkedin: "", threads: "", instagram: "", substack_note: "" };
      snShowPanel("compose");
      snComposeRender();
    }

    function snComposeRender() {
      const pane = $("sn-compose-pane");
      if (!pane) return;
      const plat = S.compose.platform;
      const PLATS = [
        { key: "substack_note", label: "Substack Note" },
        { key: "linkedin",      label: "LinkedIn" },
        { key: "threads",       label: "Threads" },
        { key: "instagram",     label: "Instagram" },
      ];

      const header =
        '<div class="card-head" style="padding:14px 20px;border-bottom:1px solid var(--line);margin-bottom:0">' +
          '<div><div class="eyebrow">New post</div><div class="section-title">Compose</div></div>' +
          (S.compose.repurpose ? '<button class="btn" style="font-size:11px" data-a="cmp-start-over">Start over</button>' : '') +
        '</div>';

      const platBar = '<div class="sn-plat-bar">' +
        PLATS.map(p =>
          '<button class="sn-plat-btn' + (p.key === plat ? ' active' : '') + '" data-a="cmp-platform" data-plat="' + p.key + '">' + p.label + '</button>'
        ).join("") +
      '</div>';

      if (S.compose.repurpose) {
        // 4-tab layout — all platforms available after repurpose
        const panelsHtml = PLATS.map(p => {
          const textId = "cmp-ta-" + p.key;
          const text = S.compose.texts[p.key] || "";
          const editor = p.key === "substack_note"
            ? _snRteHtml(textId, text || "")
            : '<textarea class="sn-det-ta" id="' + textId + '" placeholder="' + H(PL[p.key] || p.key) + ' post…">' + H(text) + '</textarea>';
          return '<div class="sn-plat-panel' + (p.key === plat ? ' active' : '') + '" id="cmp-panel-' + p.key + '">' +
            editor + _snPlatActionsHtml(textId, p.key, PL[p.key] || p.key) +
          '</div>';
        }).join("");
        const cmpSaPlats = PLATS.map(p => ({ key: p.key, label: p.label, textId: "cmp-ta-" + p.key }));
        const schedAllSection =
          '<div class="sn-note-actions-strip" style="border-bottom:none">' +
            '<button class="btn" data-a="sn-sa-open" data-panel="cmp-sa">Schedule all →</button>' +
            '<span class="muted" style="font-size:12px;align-self:center">Schedule all platforms at once</span>' +
          '</div>' +
          _snSchedAllHtml("cmp-sa", cmpSaPlats, "");
        pane.innerHTML = header + platBar + panelsHtml + schedAllSection;
      } else {
        // Single-editor mode
        const textId = "cmp-ta-" + plat;
        const platLabel = PL[plat] || plat;
        const storedText = S.compose.texts[plat] || "";
        const editor = plat === "substack_note"
          ? _snRteHtml(textId, storedText)
          : '<textarea class="sn-det-ta" id="' + textId + '" placeholder="Write your ' + H(platLabel) + ' post…">' + H(storedText) + '</textarea>';
        const editorHtml =
          '<div class="sn-plat-panel active">' +
            editor +
            '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
              '<button class="btn" data-a="copy" data-id="' + textId + '">Copy</button>' +
              '<button class="btn" data-a="social-publish" data-platform="' + plat + '" data-id="' + textId + '">Publish</button>' +
              '<button class="btn" data-a="sched-open" data-picker="sched-pk-' + textId + '">Schedule</button>' +
              '<button class="btn" style="margin-left:auto" data-a="cmp-repurpose">Cross-post →</button>' +
            '</div>' +
            '<div class="soc-schedule-picker" id="sched-pk-' + textId + '">' +
              '<label>Publish at</label>' +
              '<input type="datetime-local" id="sched-dt-' + textId + '">' +
              '<select class="sched-tz-sel" id="sched-tz-' + textId + '">' + tzOptionsHtml() + '</select>' +
              '<button class="btn" data-a="sched-confirm" data-platform="' + plat + '" data-id="' + textId + '" data-label="' + H(platLabel) + '">Confirm</button>' +
              '<button class="ghost" data-a="sched-cancel" data-picker="sched-pk-' + textId + '">Cancel</button>' +
              (plat === "instagram" ? schedInstagramImageHtml(textId, true) : '') +
            '</div>' +
          '</div>';
        pane.innerHTML = header + platBar + editorHtml;
      }
    }

    function snComposeSelectPlatform(plat) {
      // Save current editor content before switching
      const textId = "cmp-ta-" + S.compose.platform;
      const el = $(textId);
      if (el) S.compose.texts[S.compose.platform] = getElText(el);
      S.compose.platform = plat;
      snComposeRender();
    }

    async function snComposeRepurpose(btn) {
      const textId = "cmp-ta-" + S.compose.platform;
      const el = $(textId);
      if (!el) return;
      const text = (el.isContentEditable ? el.innerText : el.value).trim();
      if (!text) { alert("Write something first."); return; }
      S.compose.texts[S.compose.platform] = text;
      btn.disabled = true; btn.textContent = "Repurposing…";
      try {
        const data = await j("/api/social/compose/repurpose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, platform: S.compose.platform })
        });
        // Merge repurposed texts into S.compose.texts
        for (const k of ["linkedin", "threads", "instagram", "substack_note"]) {
          if (k !== S.compose.platform && data[k]) S.compose.texts[k] = data[k];
        }
        S.compose.repurpose = data;
        snComposeRender();
      } catch (e) {
        btn.disabled = false; btn.textContent = "Cross-post →";
        alert("Repurpose failed: " + (e.message || "unknown error"));
      }
    }

    // Fade an element out, swap its HTML, fade back in
    async function fadeSwap(el, html) {
      el.style.transition = "opacity 0.13s ease";
      el.style.opacity = "0";
      await new Promise(r => setTimeout(r, 140));
      el.innerHTML = html;
      el.style.opacity = "1";
    }

    function schedInstagramImageHtml(textId, alwaysShow) {
      return '<div class="sched-img-section' + (alwaysShow ? ' show' : '') + '" id="sched-img-' + textId + '">' +
        '<div class="sched-img-row">' +
          '<textarea class="sched-img-prompt" id="sched-img-prompt-' + textId + '" placeholder="Describe the image… (leave blank to auto-generate from post text)" rows="2"></textarea>' +
          '<button class="btn" data-a="sched-gen-image" data-text-id="' + textId + '">Generate</button>' +
        '</div>' +
        '<div class="sched-img-preview" id="sched-img-preview-' + textId + '"></div>' +
        '<input type="url" class="sched-img-url" id="sched-img-url-' + textId + '" placeholder="Paste public image URL for Instagram…">' +
        '<div class="sched-img-note">Generate an image above, then paste its local path (e.g. /static/generated/abc.jpg) — or any public URL. instagrapi uploads it directly from disk.</div>' +
      '</div>';
    }

    function snSkeletonHtml(rows) {
      return Array.from({ length: rows }, () => '<div class="skeleton-row"></div>').join("");
    }

    async function loadSnBatches() {
      const el = $("sn-batch-rail");
      if (el) el.innerHTML = snSkeletonHtml(4);
      try {
        const data = await j("/api/substack-notes/batches");
        S.snBatches = data.batches || [];
        snBatchRailRender();
        // Auto-open most recent batch if nothing selected
        if (S.snBatches.length && !Object.keys(S.snOpenBatches).length) {
          const first = S.snBatches[0];
          S.snOpenBatches[first.id] = true;
          snBatchRailRender();
          if (!S.snBatchNotesCache[first.id]) {
            j("/api/substack-notes/batches/" + first.id).then(d => {
              S.snBatchNotesCache[first.id] = d.notes || [];
              const notesEl = $("sn-batch-notes-" + first.id);
              if (notesEl) notesEl.innerHTML = _snBatchNotesListHtml(first.id, S.snBatchNotesCache[first.id]);
            });
          }
        }
      } catch (e) {
        if (el) el.innerHTML = '<div class="empty" style="padding:16px 0">' + H(e.message) + '</div>';
      }
    }

    async function generateSnBatch() {
      const btn = $("sn-gen-btn");
      const status = $("sn-gen-status");
      btn.disabled = true;
      status.textContent = "Generating 20 notes with Claude…";
      try {
        const data = await j("/api/substack-notes/generate", { method: "POST" });
        status.textContent = "Done — " + data.note_count + " notes" + (data.repurposed ? " (repurposed)" : "") + " in Batch #" + data.batch_id + ".";
        await loadSnBatches();
        // Auto-open the new batch
        if (data.batch_id) {
          S.snOpenBatches[data.batch_id] = true;
          snBatchRailRender();
          if (!S.snBatchNotesCache[data.batch_id]) {
            j("/api/substack-notes/batches/" + data.batch_id).then(d => {
              S.snBatchNotesCache[data.batch_id] = d.notes || [];
              const notesEl = $("sn-batch-notes-" + data.batch_id);
              if (notesEl) notesEl.innerHTML = _snBatchNotesListHtml(data.batch_id, S.snBatchNotesCache[data.batch_id]);
            });
          }
        }
      } catch (e) {
        status.textContent = "Error: " + (e.message || "generation failed");
      } finally {
        btn.disabled = false;
      }
    }

    // --- Quotes ---------------------------------------------------------------

    const QUOTE_TYPE_LABEL = { insight: "Insight", rule: "Rule", analogy: "Analogy", observation: "Observation", question: "Question" };

    function renderPipeQuotes() {
      const el = $("pipe-quotes-out");
      if (!el) return;
      const quotes = S.runData.quotes || [];
      if (!quotes.length) {
        el.innerHTML = '<div class="empty">No quotes extracted yet.</div>';
        return;
      }
      el.innerHTML = quotes.map((q, i) =>
        '<div class="quote-card' + (q.shared ? " shared" : "") + (q.signal === "positive" ? " signal-positive" : q.signal === "negative" ? " signal-negative" : "") + '">' +
          '<div class="quote-card-body">' +
            '<blockquote>' + H(q.quote_text || q.quote || "") + '</blockquote>' +
            (q.context ? '<div class="quote-context">' + H(q.context) + '</div>' : '') +
          '</div>' +
          '<div class="quote-card-foot">' +
            '<span class="quote-type">' + H(QUOTE_TYPE_LABEL[q.quote_type] || q.quote_type || "insight") + '</span>' +
            '<button class="btn" data-a="qt-copy" data-text="' + H(q.quote_text || q.quote || "") + '">Copy</button>' +
          '</div>' +
        '</div>'
      ).join("");
    }

    function quotesRunsRender() {
      const el = $("qt-run-list");
      if (!el) return;
      if (!S.quotesRuns.length) {
        el.innerHTML = '<div class="empty" style="padding:20px">No quotes saved yet.</div>';
        return;
      }
      el.innerHTML = S.quotesRuns.map(r =>
        '<button class="entry-item' + (S.quotesRunId === r.run_id ? " entry-active" : "") + '" style="width:100%;text-align:left;background:none;border:none;cursor:pointer" data-a="qt-run-select" data-run-id="' + r.run_id + '">' +
          '<div style="font-weight:700;font-size:13px">' + H(r.article_title || "Run #" + r.run_id) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + r.quote_count + ' quotes &middot; ' + timeAgo(r.timestamp) + '</div>' +
        '</button>'
      ).join("");
    }

    function quoteDetailRender() {
      const el = $("qt-detail-list");
      const titleEl = $("qt-detail-title");
      const countEl = $("qt-detail-count");
      if (!el) return;
      const quotes = S.quotesData;
      if (!quotes.length) {
        el.innerHTML = '<div class="empty" style="padding:20px">No quotes found.</div>';
        return;
      }
      const run = S.quotesRuns.find(r => r.run_id === S.quotesRunId);
      if (titleEl) titleEl.textContent = (run && run.article_title) || "Quotes";
      if (countEl) countEl.textContent = quotes.length + " quotes";
      el.innerHTML = '<div class="quote-list">' + quotes.map(q => {
        const hasRep = q.linkedin_post || q.threads_post || q.instagram_post;
        return '<div class="quote-card' + (q.shared ? " shared" : "") + (q.signal === "positive" ? " signal-positive" : q.signal === "negative" ? " signal-negative" : "") + '" id="qt-card-' + q.id + '">' +
          '<div class="quote-card-body">' +
            '<blockquote>' + H(q.quote_text) + '</blockquote>' +
            (q.context ? '<div class="quote-context">' + H(q.context) + '</div>' : '') +
          '</div>' +
          '<div class="quote-card-foot">' +
            '<span class="quote-type">' + H(QUOTE_TYPE_LABEL[q.quote_type] || q.quote_type || "insight") + '</span>' +
            '<button class="btn' + (q.shared ? " ok" : "") + '" data-a="qt-shared" data-qid="' + q.id + '">' + (q.shared ? '✓ Shared' : 'Mark shared') + '</button>' +
            '<button class="btn" data-a="qt-signal-pos" data-qid="' + q.id + '" title="Good signal"' + (q.signal === "positive" ? ' style="border-color:var(--ok);color:var(--ok)"' : '') + '>+</button>' +
            '<button class="btn" data-a="qt-signal-neg" data-qid="' + q.id + '" title="Low signal"' + (q.signal === "negative" ? ' style="border-color:var(--danger);color:var(--danger)"' : '') + '>–</button>' +
            '<button class="btn" data-a="qt-copy" data-text="' + H(q.quote_text) + '">Copy</button>' +
            '<button class="btn" data-a="qt-repurpose" data-qid="' + q.id + '" data-quote="' + encodeURIComponent(q.quote_text) + '" data-context="' + encodeURIComponent(q.context || "") + '" data-title="' + encodeURIComponent(q.article_title || "") + '" data-url="' + encodeURIComponent(q.article_url || "") + '">' + (hasRep ? 'Repurpose ✓' : 'Repurpose →') + '</button>' +
            '<button class="btn" data-a="qt-promote" data-qid="' + q.id + '" style="margin-left:auto">→ Ideas</button>' +
          '</div>' +
          (hasRep ? (
            '<div class="quote-repurpose" id="qt-rep-' + q.id + '">' +
              '<div class="tabs">' +
                ['linkedin', 'threads', 'instagram'].map(p =>
                  '<button class="tab' + (p === 'linkedin' ? ' active' : '') + '" data-a="qt-rep-tab" data-qid="' + q.id + '" data-plat="' + p + '">' + (p === 'linkedin' ? 'LinkedIn' : p === 'threads' ? 'Threads' : 'Instagram') + '</button>'
                ).join('') +
              '</div>' +
              ['linkedin', 'threads', 'instagram'].map((p, i) => {
                const txt = p === 'linkedin' ? q.linkedin_post : p === 'threads' ? q.threads_post : q.instagram_post;
                return '<div class="qt-rep-panel' + (i === 0 ? ' active' : '') + '" id="qt-rp-' + q.id + '-' + p + '">' +
                  '<div class="quote-rep-body">' + H(txt) + '</div>' +
                  '<div class="quote-rep-actions">' +
                    '<button class="btn" data-a="qt-rep-publish" data-plat="' + p + '" data-text="' + H(txt) + '" data-label="Quote">Publish now</button>' +
                  '</div>' +
                '</div>';
              }).join('') +
            '</div>'
          ) : '') +
        '</div>';
      }).join("") + '</div>';
    }

    async function loadQuotesRuns() {
      $("qt-run-list").innerHTML = '<div class="empty" style="padding:20px">Loading...</div>';
      try {
        const data = await j("/api/quotes");
        S.quotesRuns = data.runs || [];
        quotesRunsRender();
        if (S.quotesRuns.length && !S.quotesRunId) {
          await selectQuotesRun(S.quotesRuns[0]);
        }
      } catch (e) {
        $("qt-run-list").innerHTML = '<div class="empty" style="padding:20px">' + H(e.message) + '</div>';
      }
    }

    async function selectQuotesRun(run) {
      S.quotesRunId = run.run_id;
      quotesRunsRender();
      $("qt-detail-list").innerHTML = '<div class="empty" style="padding:20px">Loading quotes...</div>';
      try {
        const data = await j("/api/quotes/" + run.run_id);
        S.quotesData = data.quotes || [];
        quoteDetailRender();
      } catch (e) {
        $("qt-detail-list").innerHTML = '<div class="empty" style="padding:20px">' + H(e.message) + '</div>';
      }
    }

    // --- Substack Post Composer ------------------------------------------------

    function renderSubstackComposer() {
      const d = S.runData;
      const title = $("sub-title");
      const tease = $("sub-companion-tease");
      if (title && !title.value && d.title) title.value = d.title;
      if (tease && !tease.value && d.companionTitle) tease.value = "In our next paid companion we will work on: " + d.companionTitle;
    }

    function assembleSubstackMarkdown() {
      const title = ($("sub-title") && $("sub-title").value.trim()) || S.runData.title || "";
      const subtitle = ($("sub-subtitle") && $("sub-subtitle").value.trim()) || "";
      const body = S.runData.reflectionEn || "";
      const cta = ($("sub-cta-text") && $("sub-cta-text").value.trim()) || "";
      const tease = ($("sub-companion-tease") && $("sub-companion-tease").value.trim()) || "";
      const signOff = ($("sub-sign-off") && $("sub-sign-off").value.trim()) || "Have a wonderful week!";
      const footnotes = ($("sub-footnotes") && $("sub-footnotes").value.trim()) || "";

      let md = "";
      if (title) md += "# " + title + "\n";
      if (subtitle) md += "## " + subtitle + "\n\n";
      md += "---\n\n";
      md += body + "\n\n";
      if (cta) md += "---\n\n> " + cta + "\n\n---\n\n";
      if (tease) md += "*" + tease + "*\n\n";
      md += signOff + "\n";
      if (footnotes) md += "\n---\n\n" + footnotes + "\n";
      return md;
    }

    function assembleSubstackHtml() {
      const title = ($("sub-title") && $("sub-title").value.trim()) || S.runData.title || "";
      const subtitle = ($("sub-subtitle") && $("sub-subtitle").value.trim()) || "";
      const body = S.runData.reflectionEn || "";
      const cta = ($("sub-cta-text") && $("sub-cta-text").value.trim()) || "";
      const tease = ($("sub-companion-tease") && $("sub-companion-tease").value.trim()) || "";
      const signOff = ($("sub-sign-off") && $("sub-sign-off").value.trim()) || "Have a wonderful week!";
      const footnotes = ($("sub-footnotes") && $("sub-footnotes").value.trim()) || "";

      // Convert simple markdown body to HTML (basic: headings, paragraphs)
      function mdToHtml(text) {
        return text.split("\n\n").filter(Boolean).map(para => {
          para = para.trim();
          if (para.startsWith("### ")) return "<h3>" + H(para.slice(4)) + "</h3>";
          if (para.startsWith("## ")) return "<h2>" + H(para.slice(3)) + "</h2>";
          if (para.startsWith("# ")) return "<h1>" + H(para.slice(2)) + "</h1>";
          if (para === "---") return "<hr>";
          // inline bold/italic
          para = para.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
          return "<p>" + para.replace(/\n/g, "<br>") + "</p>";
        }).join("\n");
      }

      let html = "";
      if (title) html += "<h1>" + H(title) + "</h1>\n";
      if (subtitle) html += "<h2 style='font-weight:400;color:#888'>" + H(subtitle) + "</h2>\n";
      html += "<hr>\n";
      html += mdToHtml(body) + "\n";
      if (cta) html += "<hr>\n<blockquote>" + H(cta) + "</blockquote>\n<hr>\n";
      if (tease) html += "<p><em>" + H(tease) + "</em></p>\n";
      html += "<p>" + H(signOff) + "</p>\n";
      if (footnotes) html += "<hr>\n<p style='font-size:12px;color:#888'>" + H(footnotes).replace(/\n/g, "<br>") + "</p>\n";
      return html;
    }

    function refreshSubstackPreview() {
      const el = $("sub-preview-body");
      if (!el) return;
      if (!S.runData.reflectionEn) {
        el.textContent = "Run the pipeline first — the reflection body will be assembled here.";
        return;
      }
      // Show as plain text preview (pre-wrap rendering of the markdown)
      el.textContent = assembleSubstackMarkdown();
    }

    // --- Scheduled posts -------------------------------------------------------

    const SCHED_PLATFORM_LABEL = { linkedin: "LinkedIn", threads: "Threads", instagram: "Instagram", substack_note: "Substack Note" };

    function tzOptionsHtml() {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return [
        { label: "My local time (" + local + ")", value: "" },
        { label: "UTC / GMT", value: "UTC" },
        { label: "New York (ET)", value: "America/New_York" },
        { label: "Chicago (CT)", value: "America/Chicago" },
        { label: "Denver (MT)", value: "America/Denver" },
        { label: "Los Angeles (PT)", value: "America/Los_Angeles" },
        { label: "London (GMT/BST)", value: "Europe/London" },
        { label: "Paris / Madrid (CET)", value: "Europe/Paris" },
        { label: "Tokyo (JST)", value: "Asia/Tokyo" },
        { label: "Sydney (AEST)", value: "Australia/Sydney" },
      ].map(opt => '<option value="' + H(opt.value) + '">' + H(opt.label) + '</option>').join("");
    }

    // Convert a datetime-local string (treated as time in ianaTimezone) to UTC ISO (no Z)
    function tzToUtcIso(dtLocal, ianaTimezone) {
      if (!ianaTimezone) return new Date(dtLocal).toISOString().slice(0, 19);
      const roughDate = new Date(dtLocal);
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: ianaTimezone, year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const displayedStr = fmt.format(roughDate).replace(", ", "T");
      const offsetMs = roughDate.getTime() - new Date(displayedStr).getTime();
      return new Date(roughDate.getTime() + offsetMs).toISOString().slice(0, 19);
    }

    function schedQueueRender(posts) {
      const el = $("sched-queue-list");
      if (!el) return;
      if (!posts || !posts.length) {
        el.innerHTML = '<div class="empty" style="padding:20px">No scheduled posts.</div>';
        return;
      }
      el.innerHTML = posts.map(p => {
        // Parse as UTC (new records store UTC ISO; legacy records stored local — acceptable migration)
        const utcMs = Date.parse(p.scheduled_at + (p.scheduled_at.endsWith("Z") ? "" : "Z"));
        const tz = p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        let dtStr;
        if (!isNaN(utcMs)) {
          const fmtTz = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
          dtStr = fmtTz.format(utcMs);
          const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz !== localTz) {
            const fmtLocal = new Intl.DateTimeFormat("en-US", { timeZone: localTz, hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
            dtStr += " · " + fmtLocal.format(utcMs);
          }
        } else {
          dtStr = p.scheduled_at;
        }
        const canCancel = p.status === "pending";
        return '<div class="sched-item">' +
          '<div class="sched-item-head">' +
            '<span class="tag" style="font-size:10px">' + H(SCHED_PLATFORM_LABEL[p.platform] || p.platform) + '</span>' +
            (p.source_label ? '<span style="font-size:10px;color:var(--muted)">' + H(p.source_label) + '</span>' : '') +
            '<span class="sched-status ' + p.status + '">' + p.status + '</span>' +
            '<span style="font-size:11px;color:var(--muted);margin-left:auto;white-space:nowrap">' + H(dtStr) + '</span>' +
          '</div>' +
          '<div class="sched-item-text">' + renderMarkdown(p.text) + '</div>' +
          '<button class="sched-item-expand" onclick="this.closest(\'.sched-item\').classList.toggle(\'expanded\')" title="Expand">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          (p.error ? '<div style="font-size:11px;color:var(--danger);margin-top:6px;padding:6px 10px;background:rgba(200,50,50,0.06);border-radius:var(--r-sm)">Error: ' + H(p.error) + '</div>' : '') +
          '<div style="display:flex;gap:6px;margin-top:10px;align-items:center">' +
            (canCancel ? '<button class="btn" data-a="sched-del" data-id="' + p.id + '">Cancel</button>' : '') +
            '<button class="ghost" data-a="sched-hard-del" data-id="' + p.id + '">Remove</button>' +
            (p.note_id ? (
              '<div style="margin-left:auto;display:flex;gap:4px">' +
              '<button class="sched-signal-btn' + (p.note_signal === 'positive' ? ' active-pos' : '') + '" data-a="sched-signal" data-note-id="' + p.note_id + '" data-val="positive" title="More like this">👍</button>' +
              '<button class="sched-signal-btn' + (p.note_signal === 'negative' ? ' active-neg' : '') + '" data-a="sched-signal" data-note-id="' + p.note_id + '" data-val="negative" title="Less like this">👎</button>' +
              '</div>'
            ) : '') +
          '</div>' +
        '</div>';
      }).join("");
      applyRoleUi(el);
    }

    async function loadScheduledQueue() {
      const el = $("sched-queue-list");
      if (el) el.innerHTML = '<div class="empty" style="padding:20px">Loading...</div>';
      try {
        const data = await j("/api/social/scheduled");
        const posts = data.posts || [];
        schedQueueRender(posts);
        setQueueCounts(posts.length);
      } catch (e) {
        if (el) el.innerHTML = '<div class="empty" style="padding:20px">' + H(e.message) + '</div>';
        setQueueCounts(0);
      }
    }

    function publishedFeedRender(posts) {
      const el = $("published-feed-list");
      if (!el) return;
      if (!posts || !posts.length) {
        el.innerHTML = '<div class="empty" style="padding:20px">No published posts yet.</div>';
        return;
      }
      el.innerHTML = posts.map(p => {
        const ts = p.published_at || p.scheduled_at || "";
        const msUtc = Date.parse(ts + (ts.endsWith("Z") ? "" : "Z"));
        const dtStr = !isNaN(msUtc) ? timeAgo(msUtc) : ts;
        const platLabel = SCHED_PLATFORM_LABEL[p.platform] || p.platform;
        return '<div class="sched-item">' +
          '<div class="sched-item-head">' +
            '<span class="tag" style="font-size:10px">' + H(platLabel) + '</span>' +
            (p.source_label ? '<span style="font-size:10px;color:var(--muted)">' + H(p.source_label) + '</span>' : '') +
            '<span class="sched-status published">published</span>' +
            '<span style="font-size:11px;color:var(--muted);margin-left:auto;white-space:nowrap">' + H(dtStr) + '</span>' +
          '</div>' +
          '<div class="sched-item-text">' + renderMarkdown(p.text) + '</div>' +
          '<button class="sched-item-expand" onclick="this.closest(\'.sched-item\').classList.toggle(\'expanded\')" title="Expand">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
          '<div style="display:flex;gap:6px;margin-top:10px">' +
            '<button class="ghost" data-a="sched-hard-del" data-id="' + p.id + '">Remove</button>' +
          '</div>' +
        '</div>';
      }).join("");
      applyRoleUi(el);
    }

    async function loadPublishedFeed() {
      const el = $("published-feed-list");
      if (el) el.innerHTML = '<div class="empty" style="padding:20px">Loading...</div>';
      try {
        const data = await j("/api/social/published");
        publishedFeedRender(data.posts || []);
      } catch (e) {
        if (el) el.innerHTML = '<div class="empty" style="padding:20px">' + H(e.message) + '</div>';
      }
    }

    function redditRender(categories, total) {
      $("reddit-results").innerHTML = Array.isArray(categories) && categories.length
        ? categories.map(category => (
          '<div class="entry"><div style="font-weight:800;margin-bottom:8px">' + H((category.emoji || "") + " " + (category.category || "")) + "</div>" +
          (category.struggles || []).map(struggle => (
            '<div class="entry" style="margin-bottom:8px"><div style="font-weight:800;margin-bottom:4px">' + H(struggle.theme || "") + '</div><div class="muted" style="margin-bottom:4px">' + H(struggle.article_angle || "") + '</div><div>Freq: ' + H(struggle.frequency || 1) + (struggle.example ? " / " + H(struggle.example) : "") + "</div></div>"
          )).join("") +
          "</div>"
        )).join("")
        : '<div class="empty">No categories returned.</div>';
      $("reddit-status").textContent = "Done. " + total + " posts analyzed. Ideas were auto-saved to the pool.";
    }

    async function runReddit() {
      $("reddit-run").disabled = true;
      $("reddit-status").textContent = "Starting Reddit scan...";
      $("reddit-results").innerHTML = '<div class="empty">Scanning Reddit...</div>';
      try {
        await sse(fetch("/api/reddit-struggles", { method: "POST" }), (type, data) => {
          if (type === "progress") $("reddit-status").textContent = data.message || "Working...";
          else if (type === "result") {
            redditRender(data.categories || [], data.total_posts || 0);
            loadIdeas();
          } else if (type === "error") {
            $("reddit-status").textContent = data.message || "Reddit scan failed.";
          }
        });
      } catch (e) {
        $("reddit-status").textContent = e.message || "Reddit scan failed.";
      } finally {
        $("reddit-run").disabled = false;
      }
    }

    function dashRender(data) {
      const allSpend = (data.total_cost_usd || 0) + (data.total_image_cost_usd || 0);
      const coveragePct = data.articles_total ? Math.min(100, Math.round((data.articles_covered || 0) / data.articles_total * 100)) : 0;
      const remainingPct = data.articles_total ? Math.min(100, Math.round((data.articles_remaining || 0) / data.articles_total * 100)) : 0;
      const stats = [
        ["Articles indexed", data.articles_total || 0, data.articles_total ? 100 : 0],
        ["Articles covered", data.articles_covered || 0, coveragePct],
        ["Articles remaining", data.articles_remaining || 0, remainingPct],
        ["Monthly runs", data.monthly_runs || 0, 100],
        ["All production spend", "$" + allSpend.toFixed(2), 100],
        ["Run spend", "$" + (data.total_cost_usd || 0).toFixed(2), 100],
        ["Image spend", "$" + (data.total_image_cost_usd || 0).toFixed(2), 100],
        ["Input tokens", ((data.total_tokens_in || 0) / 1000).toFixed(1) + "k", 100],
        ["Output tokens", ((data.total_tokens_out || 0) / 1000).toFixed(1) + "k", 100]
      ];
      $("dash-stats").innerHTML = stats.map(([label, value, pct]) => (
        '<div class="stat-card"><div class="metric-label">' + H(label) + '</div><div class="metric-value">' + H(value) + '</div><div class="meter" style="margin-top:8px"><span style="width:' + H(pct) + '%"></span></div></div>'
      )).join("");

      const platformCounts = data.platform_counts || {};
      const platformTotal = Math.max(1, ...Object.values(platformCounts));
      $("dash-platforms").innerHTML = Object.keys(platformCounts).length
        ? '<div class="platform-grid">' + Object.entries(platformCounts).map(([key, value]) => (
          '<div class="platform-card"><div class="between"><strong>' + H(PL[key] || key) + '</strong><span class="tag">' + H(value) + '</span></div><div class="meter" style="margin-top:10px"><span style="width:' + H(Math.round((value / platformTotal) * 100)) + '%"></span></div></div>'
        )).join("") + '</div>'
        : '<div class="empty">No platform data yet.</div>';

      const queue = (data.repurpose_queue || []).slice(0, 12);
      $("dash-queue-meta").textContent = queue.length ? String(queue.length) + " visible items" : "Queue is empty.";
      $("dash-queue").innerHTML = (data.repurpose_queue || []).slice(0, 12).map(article => (
        '<div class="entry queue-item"><div><div style="font-weight:800;margin-bottom:4px">' + (article.url ? '<a href="' + H(article.url) + '" target="_blank" rel="noreferrer">' + H(article.title || "Untitled") + '</a>' : H(article.title || "Untitled")) + '</div><div class="muted">' + H(article.url || "") + '</div></div><div class="queue-actions"><button class="btn" data-a="queue-pipeline" data-title="' + encodeURIComponent(article.title || "") + '" data-url="' + encodeURIComponent(article.url || "") + '">→ Pipeline</button><button class="btn" data-a="queue-use" data-title="' + encodeURIComponent(article.title || "") + '" data-url="' + encodeURIComponent(article.url || "") + '">Open in marketing</button></div></div>'
      )).join("") || '<div class="empty">Repurpose queue is empty.</div>';

      $("dash-runs").innerHTML = (data.recent_runs || []).slice(0, 5).map(run => {
        const runTags = (run.tags && typeof run.tags === "string") ? run.tags.split(",").map(t => t.trim()).filter(Boolean) : (Array.isArray(run.tags) ? run.tags : []);
        const tagsHtml = runTags.map(t => '<span class="tag" style="font-size:10px;padding:2px 7px">' + H(t) + '</span>').join("");
        return '<div class="entry-item"><div class="between"><div><div style="font-weight:700;font-size:13px">' + H(run.title || "Untitled") + '</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center"><span class="muted" style="font-size:11px">' + timeAgo(run.timestamp) + '</span>' + tagsHtml + '</div></div><div style="display:flex;gap:8px;align-items:center"><span class="tag">$' + H((run.cost_usd || 0).toFixed(4)) + '</span><button class="ghost" data-a="open-run" data-id="' + run.id + '" data-mode="pipeline">Open</button></div></div></div>';
      }).join("") || '<div class="empty">No recent runs.</div>';

      const tagCounts = data.tag_primary_counts || {};
      const tagKeys = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
      const tagMax = Math.max(1, ...tagKeys.map(k => tagCounts[k]));
      $("dash-tags").innerHTML = tagKeys.length
        ? '<div class="list">' + tagKeys.map(tag => (
          '<div class="entry" style="display:flex;align-items:center;gap:12px">' +
            '<div style="min-width:80px;font-weight:700;font-size:13px">' + H(tag) + '</div>' +
            '<div class="meter" style="flex:1"><span style="width:' + H(Math.round(tagCounts[tag] / tagMax * 100)) + '%"></span></div>' +
            '<div class="muted" style="min-width:28px;text-align:right;font-size:12px">' + H(tagCounts[tag]) + '</div>' +
          '</div>'
        )).join("") + '</div>'
        : '<div class="empty">No tagged articles yet.</div>';
    }

    function countryFlag(code) {
      if (!code || code.length !== 2) return "🌐";
      try {
        return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
      } catch { return "🌐"; }
    }

    function audienceRender(data) {
      const body = $("audience-body");
      if (!body) return;

      const total = data.total || 0;
      const paid = data.paid || 0;
      const comp = data.comp || 0;
      const free = total - paid - comp;

      // Tier summary
      const tierHtml =
        '<div class="aud-tier-row">' +
          '<div class="aud-tier"><div class="aud-tier-val">' + total + '</div><div class="aud-tier-lbl">Total</div></div>' +
          '<div class="aud-tier"><div class="aud-tier-val" style="color:var(--accent)">' + paid + '</div><div class="aud-tier-lbl">Paid</div></div>' +
          '<div class="aud-tier"><div class="aud-tier-val">' + comp + '</div><div class="aud-tier-lbl">Comp</div></div>' +
          '<div class="aud-tier"><div class="aud-tier-val">' + Math.max(0, free) + '</div><div class="aud-tier-lbl">Free</div></div>' +
        '</div>';

      // Activity distribution
      const actDist = data.activity_distribution || {};
      const ACT_LABELS = { 0: "None", 1: "Low", 2: "Moderate", 3: "Regular", 4: "High", 5: "Super" };
      const actMax = Math.max(1, ...Object.values(actDist));
      const actHtml =
        '<div class="audience-section-title">Engagement</div>' +
        [0, 1, 2, 3, 4, 5].map(r =>
          '<div class="aud-bar-row">' +
            '<div class="aud-bar-label">' + ACT_LABELS[r] + '</div>' +
            '<div class="aud-bar-track"><div class="aud-bar-fill" style="width:' + Math.round(((actDist[r] || 0) / actMax) * 100) + '%"></div></div>' +
            '<div class="aud-bar-count">' + (actDist[r] || 0) + '</div>' +
          '</div>'
        ).join("");

      // Top countries
      const countries = data.top_countries || [];
      const coverage = data.country_coverage || 0;
      const countryHtml = countries.length
        ? '<div class="audience-section-title">Top countries <span style="font-weight:400;opacity:.6">(' + coverage + ' of ' + total + ' located)</span></div>' +
          countries.slice(0, 8).map(([code, count]) =>
            '<div class="aud-country-row">' +
              '<span class="aud-country-flag">' + countryFlag(code) + '</span>' +
              '<span class="aud-country-name">' + H(code) + '</span>' +
              '<span class="aud-country-count">' + count + '</span>' +
            '</div>'
          ).join("")
        : '<div class="audience-section-title">Countries</div><div class="empty" style="padding:8px 0;font-size:12px">No location data yet.</div>';

      // Monthly growth (last 12 months)
      const growth = data.monthly_growth || {};
      const months = Object.keys(growth).sort();
      const growthMax = Math.max(1, ...Object.values(growth));
      const growthHtml = months.length
        ? '<div class="audience-section-title" style="margin-top:16px">New subscribers / month</div>' +
          '<div class="aud-growth-bars" title="Monthly new subscribers">' +
            months.map(m =>
              '<div class="aud-growth-bar" style="height:' + Math.round((growth[m] / growthMax) * 48) + 'px" title="' + H(m) + ': ' + growth[m] + '"></div>'
            ).join("") +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px">' +
            '<span>' + H(months[0] || "") + '</span><span>' + H(months[months.length - 1] || "") + '</span>' +
          '</div>'
        : '';

      body.innerHTML =
        tierHtml +
        '<div class="audience-grid" style="margin-top:16px">' +
          '<div>' + actHtml + '</div>' +
          '<div>' + countryHtml + '</div>' +
        '</div>' +
        growthHtml;

      const lbl = $("aud-sync-label");
      if (lbl && data.synced_at) lbl.textContent = "Synced " + timeAgo(data.synced_at);
    }

    async function loadAudience() {
      const body = $("audience-body");
      const btn = $("aud-refresh-btn");
      if (!body) return;
      try {
        const data = await j("/api/substack/audience");
        if (!data.total) {
          body.innerHTML = '<div class="empty">No subscriber data cached yet. Go to <strong>Audience</strong> and click Sync.</div>';
        } else {
          audienceRender(data);
        }
      } catch (e) {
        body.innerHTML = '<div class="empty">' + H(e.message || "Failed to load audience data.") + '</div>';
      }
    }

    // ── Audience browser ────────────────────────────────────────────────────

    const audBrState = {
      q: "", interval: "", activity: null,
      offset: 0, limit: 50, total: 0,
      selected: null,
    };

    function audRatingClass(r) {
      const n = parseInt(r) || 0;
      return n >= 4 ? "r" + n : n === 3 ? "r3" : "";
    }

    function audActivityLabel(r) {
      const n = parseInt(r) || 0;
      return ["None","Low","Mild","Regular","Active","Top"][n] || "?";
    }

    function audAvatarHtml(s, size) {
      const sz = size || 32;
      if (s.photo_url) return '<img class="aud-sub-avatar" src="' + H(s.photo_url) + '" width="' + sz + '" height="' + sz + '" loading="lazy">';
      const init = (s.name || s.email || "?")[0].toUpperCase();
      return '<div class="aud-sub-avatar-ph" style="width:' + sz + 'px;height:' + sz + 'px;font-size:' + Math.floor(sz * 0.4) + 'px">' + H(init) + '</div>';
    }

    function audListRender(result) {
      const list = $("aud-br-list");
      if (!list) return;
      audBrState.total = result.total || 0;
      const subs = result.subscribers || [];

      $("aud-br-count").textContent = audBrState.total.toLocaleString();

      if (!subs.length) {
        list.innerHTML = '<div class="empty">No subscribers found.</div>';
        $("aud-pg-prev").style.display = "none";
        $("aud-pg-next").style.display = "none";
        $("aud-pg-label").textContent = "";
        return;
      }

      list.innerHTML = subs.map(s => {
        const rc = audRatingClass(s.activity_rating);
        const isActive = audBrState.selected && audBrState.selected.email === s.email;
        return '<div class="aud-sub-item' + (isActive ? " active" : "") + '" data-a="aud-sub-open" data-email="' + H(s.email) + '">' +
          audAvatarHtml(s, 32) +
          '<div class="aud-sub-info">' +
            '<div class="aud-sub-name">' + H(s.name || s.email) + '</div>' +
            '<div class="aud-sub-meta">' + H(s.subscription_interval || "free") + (s.subscription_country ? " · " + countryFlag(s.subscription_country) + " " + H(s.subscription_country) : "") + '</div>' +
          '</div>' +
          '<div class="aud-sub-rating ' + rc + '">' + audActivityLabel(s.activity_rating) + '</div>' +
        '</div>';
      }).join("");

      const page = Math.floor(audBrState.offset / audBrState.limit) + 1;
      const totalPages = Math.ceil(audBrState.total / audBrState.limit);
      $("aud-pg-label").textContent = "Page " + page + " of " + totalPages;
      $("aud-pg-prev").style.display = audBrState.offset > 0 ? "" : "none";
      $("aud-pg-next").style.display = audBrState.offset + audBrState.limit < audBrState.total ? "" : "none";
    }

    async function loadAudienceList() {
      const list = $("aud-br-list");
      if (!list) return;
      list.innerHTML = '<div class="empty">Loading…</div>';
      const params = new URLSearchParams({ offset: audBrState.offset, limit: audBrState.limit });
      if (audBrState.q) params.set("q", audBrState.q);
      if (audBrState.interval) params.set("interval", audBrState.interval);
      if (audBrState.activity !== null) params.set("activity", audBrState.activity);
      try {
        const data = await j("/api/substack/subscribers?" + params.toString());
        audListRender(data);
      } catch (e) {
        list.innerHTML = '<div class="empty">' + H(e.message || "Failed to load.") + '</div>';
      }
    }

    function audDetailLoading() {
      const panel = $("aud-br-detail");
      if (panel) panel.innerHTML = '<div class="empty" style="padding:40px">Fetching profile…</div>';
    }

    function audDetailRender(sub, detail) {
      const panel = $("aud-br-detail");
      if (!panel) return;
      const d = detail || {};
      const crm = d.crmData || {};

      const opens      = crm.num_email_opens ?? "—";
      const opens30d   = crm.num_email_opens_last_30d ?? "—";
      const clicks     = crm.links_clicked ?? "—";
      const sent       = crm.num_emails_received ?? "—";
      const daysActive = crm.days_active_last_30d ?? "—";
      const lastOpened = crm.last_opened_at ? crm.last_opened_at.slice(0, 10) : "—";
      const revenue    = (crm.total_revenue_generated ?? sub.total_revenue_generated) != null
                         ? "$" + ((crm.total_revenue_generated ?? sub.total_revenue_generated) / 100).toFixed(2) : "—";
      const since   = sub.subscription_created_at ? sub.subscription_created_at.slice(0, 10) : "—";
      const country = crm.subscription_country || crm.country || sub.subscription_country || "";
      const interval = sub.subscription_interval || "free";

      panel.innerHTML =
        '<div style="padding:20px">' +
          '<div class="aud-detail-header">' +
            audAvatarHtml(sub, 56) +
            '<div>' +
              '<div class="aud-detail-name">' + H(sub.name || sub.email) + '</div>' +
              '<div class="aud-detail-email">' + H(sub.email) + '</div>' +
              (country ? '<div style="margin-top:4px;font-size:12px">' + countryFlag(country) + ' ' + H(country) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="aud-detail-grid" style="grid-template-columns:1fr 1fr 1fr">' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(sub.activity_rating || 0)) + '/5</div><div class="aud-detail-stat-lbl">Activity</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(interval)) + '</div><div class="aud-detail-stat-lbl">Plan</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + revenue + '</div><div class="aud-detail-stat-lbl">Revenue</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(opens)) + '</div><div class="aud-detail-stat-lbl">Opens (total)</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(opens30d)) + '</div><div class="aud-detail-stat-lbl">Opens (30d)</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(clicks)) + '</div><div class="aud-detail-stat-lbl">Clicks</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(sent)) + '</div><div class="aud-detail-stat-lbl">Sent</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val">' + H(String(daysActive)) + '</div><div class="aud-detail-stat-lbl">Active days (30d)</div></div>' +
            '<div class="aud-detail-stat"><div class="aud-detail-stat-val" style="font-size:13px">' + H(lastOpened) + '</div><div class="aud-detail-stat-lbl">Last opened</div></div>' +
          '</div>' +
          '<div style="margin-top:10px;font-size:11px;color:var(--muted)">Subscribed ' + H(since) + '</div>' +
        '</div>';
    }

    async function openSubscriberDetail(email) {
      audBrState.selected = { email };
      // Highlight row
      $("aud-br-list").querySelectorAll(".aud-sub-item").forEach(el => {
        el.classList.toggle("active", el.dataset.email === email);
      });
      audDetailLoading();
      try {
        const res = await j("/api/substack/subscribers/" + encodeURIComponent(email) + "/detail");
        audBrState.selected = res.subscriber || { email };
        audDetailRender(res.subscriber || { email }, res.detail || {});
      } catch (e) {
        const panel = $("aud-br-detail");
        if (panel) panel.innerHTML = '<div class="empty" style="padding:40px">' + H(e.message || "Failed to load.") + '</div>';
      }
    }

    async function syncSubscribers() {
      const btn = document.querySelector('[data-a="aud-sync"]');
      if (btn) { btn.disabled = true; btn.textContent = "Syncing…"; }
      const lbl = $("aud-br-sync-label");
      if (lbl) lbl.textContent = "";
      try {
        const res = await j("/api/substack/subscribers/sync", { method: "POST" });
        if (lbl) lbl.textContent = "Synced " + (res.synced || 0) + " subscribers";
        await loadAudienceList();
        loadAudience(); // refresh dashboard card from new local data
      } catch (e) {
        if (lbl) lbl.textContent = e.message || "Sync failed";
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "⟳ Sync"; }
      }
    }

    // ── Audience insights ────────────────────────────────────────────────────

    let _insRecTab = "attract";

    function insightsRender(data) {
      const body = $("aud-insights-body");
      if (!body) return;

      const enriched = data.enriched_count || 0;
      const total = data.total_count || 0;

      if (!enriched) {
        body.innerHTML = '<div class="empty" style="padding:40px">Not enough enriched profiles yet. The background job collects them automatically — check back soon.</div>';
        return;
      }

      // Funnel
      const funnelHtml =
        '<div class="ins-funnel">' +
          '<div class="ins-funnel-step"><div class="ins-funnel-val">100%</div><div class="ins-funnel-lbl">Sent</div></div>' +
          '<div class="ins-funnel-step"><div class="ins-funnel-val" style="color:var(--accent)">' + data.avg_open_rate + '%</div><div class="ins-funnel-lbl">Open rate</div></div>' +
          '<div class="ins-funnel-step"><div class="ins-funnel-val">' + data.avg_click_rate + '%</div><div class="ins-funnel-lbl">Click rate</div></div>' +
          '<div class="ins-funnel-step"><div class="ins-funnel-val">' + data.avg_reopen_rate + 'x</div><div class="ins-funnel-lbl">Re-opens</div></div>' +
        '</div>';

      // ICP section
      const top = data.top_segment || {};
      const icpCountries = (top.top_countries || []).slice(0, 3).map(([c, n]) => countryFlag(c) + ' ' + H(c) + ' (' + n + ')').join(' · ');
      const icpAttr = (top.top_attribution || []).slice(0, 2).map(([a, n]) => H(a.replace('substack-', '').replace('-flow', '')) + ' (' + n + ')').join(', ');
      const icpHtml =
        '<div class="ins-section">' +
          '<div class="ins-section-title">Your best readers — top ' + top.pct + '% (' + top.count + ' subscribers)</div>' +
          '<div class="ins-icp-pills">' +
            (top.creator_pct ? '<div class="ins-icp-pill">✍️ ' + top.creator_pct + '% creators</div>' : '') +
            (top.paid_pct ? '<div class="ins-icp-pill" style="background:var(--ok-soft,#d4f0dc);color:var(--ok,#1a7a3c)">💳 ' + top.paid_pct + '% paid</div>' : '') +
            (icpCountries ? '<div class="ins-icp-pill" style="background:var(--panel-soft);color:var(--fg)">' + icpCountries + '</div>' : '') +
          '</div>' +
          (icpAttr ? '<div style="font-size:11px;color:var(--muted)">Acquired via: ' + icpAttr + '</div>' : '') +
        '</div>';

      // Open rate distribution
      const buckets = data.open_rate_buckets || [0, 0, 0, 0, 0];
      const bucketMax = Math.max(1, ...buckets);
      const bucketLabels = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'];
      const bucketsHtml =
        '<div class="ins-section">' +
          '<div class="ins-section-title">Open rate distribution</div>' +
          buckets.map((n, i) =>
            '<div class="ins-bucket-row">' +
              '<div class="ins-bucket-lbl">' + bucketLabels[i] + '</div>' +
              '<div class="ins-bucket-track"><div class="ins-bucket-fill" style="width:' + Math.round(n / bucketMax * 100) + '%"></div></div>' +
              '<div class="ins-bucket-count">' + n + '</div>' +
            '</div>'
          ).join("") +
        '</div>';

      // At-risk
      const atRiskHtml =
        '<div class="ins-section">' +
          '<div class="ins-section-title">At-risk readers</div>' +
          '<div class="ins-at-risk">' +
            '<div class="ins-at-risk-num">' + data.at_risk_count + '</div>' +
            '<div><div style="font-weight:600;font-size:13px">Engaged before, gone cold</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:3px">Activity rating ≥ 3 but no opens in 45+ days</div></div>' +
          '</div>' +
        '</div>';

      // Cohort quality
      const cohort = data.cohort_quality || {};
      const cohortMonths = Object.keys(cohort);
      const cohortVals = Object.values(cohort);
      const cohortMax = Math.max(1, ...cohortVals);
      const cohortHtml = cohortMonths.length ?
        '<div class="ins-section">' +
          '<div class="ins-section-title">Cohort quality — avg engagement per signup month</div>' +
          '<div class="ins-cohort-bars">' +
            cohortMonths.map((m, i) => {
              const pct = Math.round(cohortVals[i] / cohortMax * 100);
              const isBest = m === data.best_cohort;
              return '<div class="ins-cohort-bar" style="height:' + pct + '%;background:' + (isBest ? 'var(--accent)' : 'var(--panel-soft)') + ';border:' + (isBest ? 'none' : '1px solid var(--line)') + '" title="' + H(m) + ': ' + cohortVals[i] + ' avg"></div>';
            }).join("") +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px">' +
            '<span>' + H(cohortMonths[0] || '') + '</span>' +
            '<span>' + (data.best_cohort ? '★ Best: ' + H(data.best_cohort) : '') + '</span>' +
            '<span>' + H(cohortMonths[cohortMonths.length - 1] || '') + '</span>' +
          '</div>' +
        '</div>' : '';

      // Recommendations
      const recs = data.recommendations || [];
      const attract = recs.filter(r => r.type === "attract");
      const retain  = recs.filter(r => r.type === "retain");
      const recList = _insRecTab === "attract" ? attract : retain;
      const recsHtml = recs.length ?
        '<div class="ins-section">' +
          '<div class="ins-section-title">Recommended actions</div>' +
          '<div class="ins-rec-tabs">' +
            '<button class="ins-rec-tab' + (_insRecTab === "attract" ? " active" : "") + '" data-a="ins-rec-tab" data-tab="attract">🎯 Attract (' + attract.length + ')</button>' +
            '<button class="ins-rec-tab' + (_insRecTab === "retain" ? " active" : "") + '" data-a="ins-rec-tab" data-tab="retain">🤝 Retain (' + retain.length + ')</button>' +
          '</div>' +
          '<div class="ins-rec-cards" id="ins-rec-cards">' +
            recList.map(r =>
              '<div class="ins-rec-card ' + H(r.type) + '">' +
                '<div class="ins-rec-title">' + H(r.title) + '</div>' +
                '<div class="ins-rec-action">' + H(r.action) + '</div>' +
                '<div class="ins-rec-why">' + H(r.why) + '</div>' +
              '</div>'
            ).join("") +
          '</div>' +
        '</div>' : '';

      const moreHtml =
        '<div class="ins-section" style="display:flex;gap:16px;flex-wrap:wrap">' +
          (data.web_reader_pct ? '<div style="font-size:12px"><strong>' + data.web_reader_pct + '%</strong> <span class="muted">read on web</span></div>' : '') +
          (data.commenters_count ? '<div style="font-size:12px"><strong>' + data.commenters_count + '</strong> <span class="muted">commented</span></div>' : '') +
          (data.sharers_count ? '<div style="font-size:12px"><strong>' + data.sharers_count + '</strong> <span class="muted">shared</span></div>' : '') +
        '</div>';

      body.innerHTML = funnelHtml + icpHtml + bucketsHtml + atRiskHtml + cohortHtml + moreHtml + recsHtml;
      body.dataset.recs = JSON.stringify(recs);

      const covEl = $("aud-enriched-count");
      if (covEl) covEl.textContent = enriched + ' enriched';
    }

    async function loadInsights() {
      const body = $("aud-insights-body");
      const btn = document.querySelector('[data-a="aud-insights-load"]');
      if (!body) return;
      body.innerHTML = '<div class="empty" style="padding:40px">Analysing audience… this may take a moment.</div>';
      if (btn) { btn.disabled = true; btn.textContent = "Analysing…"; }
      try {
        const data = await j("/api/substack/insights");
        insightsRender(data);
      } catch (e) {
        body.innerHTML = '<div class="empty" style="padding:40px">' + H(e.message || "Failed to load insights.") + '</div>';
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Refresh Insights"; }
      }
    }

    async function loadDash() {
      try {
        dashRender(await j("/api/dashboard"));
      } catch (e) {
        $("dash-stats").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
      }
    }

    async function loadTemplate() {
      try {
        const data = await j("/api/template");
        $("template-status").textContent = data.exists ? "Template loaded." : "Template not found.";
      } catch (e) {
        $("template-status").textContent = e.message;
      }
    }

    async function upTemplate() {
      const file = $("template-file").files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        await j("/api/template", { method: "POST", body: fd });
        $("template-status").textContent = "Template uploaded.";
      } catch (e) {
        $("template-status").textContent = e.message;
      }
    }

    async function loadArticles() {
      try {
        const data = await j("/api/articles");
        $("articles-status").textContent = (data.count || 0) + " articles indexed.";
      } catch (e) {
        $("articles-status").textContent = e.message;
      }
    }

    async function refreshArticles() {
      $("articles-status").textContent = "Refreshing full index...";
      try {
        const data = await j("/api/articles/refresh", { method: "POST" });
        $("articles-status").textContent = (data.count || 0) + " articles indexed.";
      } catch (e) {
        $("articles-status").textContent = e.message;
      }
    }

    async function newArticles() {
      $("articles-status").textContent = "Checking for new articles...";
      try {
        const data = await j("/api/articles/index-new", { method: "POST" });
        $("articles-status").textContent = (data.total || data.count || 0) + " total / " + (data.added || 0) + " added.";
      } catch (e) {
        $("articles-status").textContent = e.message;
      }
    }

    async function loadCfg() {
      try {
        const data = await j("/api/config");
        $("cfg-voice").value = data.voice_brief || "";
        $("cfg-comp").value = data.companion_voice_brief || "";
        $("cfg-es").value = data.spanish_style_guide || "";
        $("cfg-th").value = data.thumbnail_prompt || "";
        renderConfigPreviews();
      } catch (e) {
        $("cfg-status").textContent = e.message;
      }
    }

    async function saveCfg() {
      try {
        await j("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voice_brief: $("cfg-voice").value,
            companion_voice_brief: $("cfg-comp").value,
            spanish_style_guide: $("cfg-es").value,
            thumbnail_prompt: $("cfg-th").value
          })
        });
        $("cfg-status").textContent = "Saved.";
      } catch (e) {
        $("cfg-status").textContent = e.message;
      }
    }

    function renderMarkdown(text) {
      const source = String(text || "").replace(/\r\n?/g, "\n").trim();
      if (!source) return '<p class="muted">Nothing to preview yet.</p>';

      function inline(value) {
        let html = H(value || "");
        html = html.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, linkText, url) => {
          const safe = /^javascript:/i.test(url.trim()) ? "#" : url.trim();
          const ext = /^https?:\/\//.test(safe) ? ' target="_blank" rel="noreferrer"' : "";
          return '<a href="' + safe + '"' + ext + ">" + linkText + "</a>";
        });
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/(^|[^\w])_(.+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        return html;
      }

      const lines = source.split("\n");
      const out = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
          i += 1;
          continue;
        }

        if (/^```/.test(trimmed)) {
          const block = [];
          i += 1;
          while (i < lines.length && !/^```/.test(lines[i].trim())) {
            block.push(lines[i]);
            i += 1;
          }
          if (i < lines.length) i += 1;
          out.push("<pre>" + H(block.join("\n")) + "</pre>");
          continue;
        }

        if (/^---+$/.test(trimmed)) {
          out.push("<hr>");
          i += 1;
          continue;
        }

        const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (heading) {
          const level = heading[1].length;
          out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
          i += 1;
          continue;
        }

        if (/^>\s?/.test(trimmed)) {
          const quote = [];
          while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
            quote.push(lines[i].trim().replace(/^>\s?/, ""));
            i += 1;
          }
          out.push("<blockquote>" + inline(quote.join("\n")).replace(/\n/g, "<br>") + "</blockquote>");
          continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
          const items = [];
          while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
            items.push("<li>" + inline(lines[i].trim().replace(/^[-*]\s+/, "")) + "</li>");
            i += 1;
          }
          out.push("<ul>" + items.join("") + "</ul>");
          continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const items = [];
          while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
            items.push("<li>" + inline(lines[i].trim().replace(/^\d+\.\s+/, "")) + "</li>");
            i += 1;
          }
          out.push("<ol>" + items.join("") + "</ol>");
          continue;
        }

        const para = [trimmed];
        i += 1;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (!next || /^```/.test(next) || /^---+$/.test(next) || /^(#{1,4})\s+/.test(next) || /^>\s?/.test(next) || /^[-*]\s+/.test(next)) break;
          para.push(next);
          i += 1;
        }
        out.push("<p>" + inline(para.join(" ")).replace(/\n/g, "<br>") + "</p>");
      }

      return out.join("") || '<p class="muted">Nothing to preview yet.</p>';
    }

    function renderConfigPreviews() {
      $("cfg-voice-preview").innerHTML = renderMarkdown($("cfg-voice").value);
      $("cfg-comp-preview").innerHTML = renderMarkdown($("cfg-comp").value);
      $("cfg-es-preview").innerHTML = renderMarkdown($("cfg-es").value);
      $("cfg-th-preview").innerHTML = renderMarkdown($("cfg-th").value);
    }

    function setMdView(target, view) {
      document.querySelectorAll('[data-md-target="' + target + '"]').forEach(button => {
        button.classList.toggle("active", button.dataset.mdView === view);
      });
      const editor = document.querySelector('[data-md-editor="' + target + '"]');
      const preview = document.querySelector('[data-md-preview="' + target + '"]');
      if (editor) editor.classList.toggle("hide", view !== "edit");
      if (preview) preview.classList.toggle("hide", view !== "read");
    }

    function setDocView(id, view) {
      const surface = $(id + "-surface");
      if (!surface) return;
      surface.dataset.view = view;
      const root = $(id);
      if (!root) return;
      root.querySelectorAll('[data-a="doc-view"]').forEach(button => {
        button.classList.toggle("active", button.dataset.view === view);
      });
    }

    function thRender() {
      const concepts = S.thumbDraft.concepts || [];
      if (!concepts.length) S.thumbConceptSelected = null;
      else if (!S.thumbConceptSelected || !concepts.some(item => Number(item.index) === Number(S.thumbConceptSelected))) {
        S.thumbConceptSelected = concepts[0].index;
      }
      $("th-concepts").innerHTML = concepts.length
        ? concepts.map(item => (
          (() => {
            const optionNumber = Number(item.index) + 1;
            const rawName = String(item.name || "").trim();
            const displayName = /^concept\b/i.test(rawName) || !rawName ? ("Option " + optionNumber) : rawName;
            return (
          '<div class="concept' + (Number(S.thumbConceptSelected) === Number(item.index) ? ' active' : '') + '" data-a="pick-concept" data-index="' + item.index + '"><div class="concept-media">' +
          (item.image_b64 ? '<img src="data:image/png;base64,' + item.image_b64 + '" alt="' + H(item.name || "Thumbnail concept") + '">' : '<div class="muted" style="padding:24px;text-align:center;font-size:12px">Waiting for image</div>') +
          '</div><div class="concept-body"><div class="between" style="margin-bottom:6px"><div style="font-weight:800;font-size:13px">' + H(displayName) + '</div>' +
          (item.image_b64 ? '<button class="btn" data-a="save-thumb" data-index="' + item.index + '" style="font-size:11px;padding:5px 10px">Save</button>' : '') +
          '</div><div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:6px">' + H(item.scene || "") + '</div>' +
          (item.why ? '<div style="font-size:10px;color:var(--muted);font-style:italic;opacity:0.8">' + H(item.why) + '</div>' : '') +
          '</div></div>'
            );
          })()
        )).join("")
        : '<div class="empty">No thumbnail concepts yet.</div>';
      renderThumbInspector();
    }

    function renderThumbInspector() {
      const item = (S.thumbDraft.concepts || []).find(v => Number(v.index) === Number(S.thumbConceptSelected));
      $("th-inspector").innerHTML = item
        ? '<div><div class="inspector-media">' +
          (item.image_b64 ? '<img src="data:image/png;base64,' + item.image_b64 + '" alt="' + H(item.name || "Thumbnail concept") + '">' : '<div class="muted">Image not rendered yet.</div>') +
          '</div><div class="inspector-copy"><div><div style="font-weight:800">' + H(item.name || "Untitled concept") + '</div><div class="muted" style="margin-top:4px">Concept #' + H(item.index) + '</div></div><div>' + H(item.scene || "") + '</div>' +
          (item.why ? '<div class="muted">' + H(item.why) + '</div>' : '') +
          '<div class="inspector-block"><strong>Prompt</strong><pre>' + H(item.revised_prompt || item.dalle_prompt || "") + '</pre></div>' +
          (item.image_b64 ? '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button class="pri" data-a="save-thumb" data-index="' + item.index + '" id="th-save-btn">Save thumbnail</button><button class="btn" data-a="dl-thumb" data-draft-index="' + item.index + '" data-name="' + H((item.name || "thumbnail").replace(/\s+/g, "-").toLowerCase()) + '">Download</button><span id="th-save-status" style="font-size:12px;color:var(--muted)"></span></div>' : '<div class="muted">Render images to enable saving.</div>') +
          '</div></div>'
        : '<div class="empty">Select a concept to inspect it here.</div>';
    }

    function setThumbTab(name) {
      S.thumbTab = name;
      document.querySelectorAll("[data-th-tab]").forEach(button => button.classList.toggle("active", button.dataset.thTab === name));
      document.querySelectorAll(".thumb-pane").forEach(node => node.classList.toggle("active", node.id === "th-pane-" + name));
      if (name === "library") loadThumbs();
    }

    function renderThumbList() {
      $("th-lib-meta").textContent = S.thumbs.length ? String(S.thumbs.length) + " results loaded" : "No results loaded.";
      $("th-lib").innerHTML = S.thumbs.length
        ? S.thumbs.map(item => (
          '<button class="thumb' + (S.thumbSelected && Number(S.thumbSelected.id) === Number(item.id) ? ' active' : '') + '" data-a="open-thumb" data-id="' + item.id + '"><div class="thumb-row"><div class="thumb-meta"><div class="thumb-title">' + H(item.article_title || "Untitled") + '</div><div class="thumb-sub">' + H(item.concept_name || "Saved thumbnail") + '</div></div><span class="tag">' + H(timeAgo(item.timestamp)) + '</span></div>' +
          (item.article_url ? '<div class="thumb-url">' + H(item.article_url) + '</div>' : "") +
          '</button>'
        )).join("")
        : '<div class="empty">No thumbnails match this search.</div>';
    }

    function renderThumbDetail() {
      const item = S.thumbSelected;
      $("th-detail").innerHTML = item
        ? '<div class="thumb-detail-card"><img src="data:image/png;base64,' + item.image_b64 + '" alt="' + H(item.article_title || "Thumbnail") + '"><div class="thumb-detail-top"><div class="thumb-detail-meta"><div class="thumb-title">' + H(item.article_title || "Untitled") + '</div><div class="thumb-sub">' + H(item.concept_name || "Saved thumbnail") + '</div></div><div style="display:flex;gap:6px"><button class="btn" data-a="dl-thumb" data-source="library" data-name="' + H((item.article_title || "thumbnail").replace(/\s+/g, "-").toLowerCase()) + '">Download</button><button class="ghost" data-a="del-thumb" data-id="' + item.id + '">Delete</button></div></div>' +
          (item.article_url ? '<a class="thumb-detail-url" href="' + H(item.article_url) + '" target="_blank" rel="noreferrer">' + H(item.article_url) + '</a>' : "") +
          '<div class="thumb-detail-stamp">' + H(dt(item.timestamp)) + '</div></div>'
        : '<div class="empty">Select a thumbnail to preview it here.</div>';
    }

    async function openThumb(id) {
      try {
        $("th-detail").innerHTML = '<div class="empty">Loading thumbnail...</div>';
        S.thumbSelected = await j("/api/thumbnails/" + id);
        renderThumbList();
        renderThumbDetail();
      } catch (e) {
        $("th-detail").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
      }
    }

    async function loadThumbs() {
      $("th-lib").innerHTML = '<div class="empty">Loading saved thumbnails...</div>';
      try {
        const query = $("th-search") ? $("th-search").value.trim() : "";
        const data = await j("/api/thumbnails?q=" + encodeURIComponent(query) + "&limit=100");
        S.thumbs = data.thumbnails || [];
        S.thumbsLoaded = true;
        if (S.thumbSelected && !S.thumbs.some(item => Number(item.id) === Number(S.thumbSelected.id))) {
          S.thumbSelected = null;
        }
        renderThumbList();
        renderThumbDetail();
      } catch (e) {
        $("th-lib").innerHTML = '<div class="empty">' + H(e.message) + "</div>";
        $("th-lib-meta").textContent = "Library failed to load.";
      }
    }

    async function genConcepts(auto) {
      const title = $("th-title").value.trim();
      const text = $("th-text").value.trim();
      if (!title || !text) {
        $("th-status").textContent = "Article title and text are required.";
        return;
      }
      S.thumbDraft = { concepts: [], review: !auto };
      $("th-status").textContent = auto ? "Generating concepts and images..." : "Generating concepts for review...";
      $("th-cost").textContent = "Thumbnail generation cost will appear here.";
      animateMeter("th-fill", "thTimer");
      $("th-images").classList.add("hide");
      thRender();
      try {
        await sse(fetch("/api/generate-thumbnail-concepts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, article_text: text, auto_generate: auto })
        }), (type, data) => {
          if (type === "concepts_ready") {
            S.thumbDraft.concepts = (data.concepts || []).map(item => Object.assign({}, item));
            thRender();
            $("th-status").textContent = auto ? "Concepts ready. Rendering images..." : "Concepts ready for review.";
            $("th-fill").style.width = auto ? "30%" : "45%";
            if (!auto) $("th-images").classList.remove("hide");
          } else if (type === "concept_image") {
            const match = S.thumbDraft.concepts.find(item => Number(item.index) === Number(data.index));
            if (match) {
              match.image_b64 = data.image_b64 || "";
              match.revised_prompt = data.revised_prompt || "";
            }
            thRender();
            $("th-status").textContent = "Rendering images...";
            const ready = S.thumbDraft.concepts.filter(item => item.image_b64).length;
            const total = Math.max(1, S.thumbDraft.concepts.length);
            $("th-fill").style.width = (35 + Math.round((ready / total) * 60)) + "%";
          } else if (type === "image_cost") {
            $("th-status").textContent = "Image cost $" + Number(data.cost_usd || 0).toFixed(4);
            setOpCost("th-cost", data.cost_usd || 0, (data.count || 0) + " images");
          } else if (type === "error") {
            $("th-status").textContent = data.message || "Thumbnail generation failed.";
            $("th-fill").style.width = "0%";
          } else if (type === "done") {
            $("th-status").textContent = auto ? "Done." : "Review the concepts, then generate images.";
            $("th-fill").style.width = auto ? "100%" : ($("th-fill").style.width || "45%");
          }
        });
      } catch (e) {
        $("th-status").textContent = e.message || "Thumbnail generation failed.";
        $("th-fill").style.width = "0%";
      } finally {
        animateMeter("th-fill", "thTimer", true);
      }
    }

    async function genImages() {
      const concepts = S.thumbDraft.concepts || [];
      if (!concepts.length) return;
      $("th-status").textContent = "Generating images for reviewed concepts...";
      $("th-cost").textContent = "Thumbnail generation cost will appear here.";
      animateMeter("th-fill", "thTimer");
      try {
        await sse(fetch("/api/generate-thumbnail-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concepts: concepts.map(item => ({ index: item.index, name: item.name, scene: item.scene, dalle_prompt: item.dalle_prompt })) })
        }), (type, data) => {
          if (type === "concept_image") {
            const match = S.thumbDraft.concepts.find(item => Number(item.index) === Number(data.index));
            if (match) {
              match.image_b64 = data.image_b64 || "";
              match.revised_prompt = data.revised_prompt || "";
            }
            thRender();
            const ready = S.thumbDraft.concepts.filter(item => item.image_b64).length;
            const total = Math.max(1, S.thumbDraft.concepts.length);
            $("th-fill").style.width = (30 + Math.round((ready / total) * 70)) + "%";
          } else if (type === "image_cost") {
            $("th-status").textContent = "Image cost $" + Number(data.cost_usd || 0).toFixed(4);
            setOpCost("th-cost", data.cost_usd || 0, (data.count || 0) + " images");
          } else if (type === "error") {
            $("th-status").textContent = data.message || "Image generation failed.";
            $("th-fill").style.width = "0%";
          } else if (type === "done") {
            $("th-status").textContent = "Done.";
            $("th-fill").style.width = "100%";
          }
        });
      } catch (e) {
        $("th-status").textContent = e.message || "Image generation failed.";
        $("th-fill").style.width = "0%";
      } finally {
        animateMeter("th-fill", "thTimer", true);
      }
    }

    async function genSingle() {
      const title = $("th-title").value.trim();
      if (!title) {
        $("th-status").textContent = "Title is required for one-off thumbnail generation.";
        return;
      }
      $("th-status").textContent = "Generating one custom thumbnail...";
      $("th-cost").textContent = "Thumbnail generation cost will appear here.";
      animateMeter("th-fill", "thTimer");
      try {
        const data = await j("/api/generate-thumbnail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, prompt_override: $("th-prompt").value.trim() || null })
        });
        S.thumbDraft.concepts = [{
          index: 0,
          name: "Custom thumbnail",
          scene: "One-off thumbnail generation",
          why: "",
          dalle_prompt: $("th-prompt").value.trim(),
          image_b64: data.image_b64,
          revised_prompt: data.revised_prompt
        }];
        thRender();
        $("th-status").textContent = "Done. Cost $" + Number(data.cost_usd || 0).toFixed(4);
        $("th-fill").style.width = "100%";
        setOpCost("th-cost", data.cost_usd || 0, "1 image");
      } catch (e) {
        $("th-status").textContent = e.message || "Custom thumbnail generation failed.";
        $("th-fill").style.width = "0%";
      } finally {
        animateMeter("th-fill", "thTimer", true);
      }
    }

    async function saveThumb(index) {
      const concept = S.thumbDraft.concepts.find(item => Number(item.index) === Number(index));
      if (!concept || !concept.image_b64) return;
      const btn = $("th-save-btn");
      const inlineStatus = $("th-save-status");
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
      try {
        const data = await j("/api/thumbnails/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article_title: $("th-title").value.trim(),
            article_url: $("th-url").value.trim(),
            concept_name: concept.name || "Thumbnail concept",
            image_b64: concept.image_b64
          })
        });
        const msg = data.created ? "Saved to library." : "Already in library.";
        $("th-status").textContent = msg;
        if (inlineStatus) inlineStatus.textContent = msg;
        if (btn) { btn.textContent = data.created ? "✓ Saved" : "Already saved"; }
        if (S.thumbTab === "library") loadThumbs();
      } catch (e) {
        const msg = e.message || "Failed to save thumbnail.";
        $("th-status").textContent = msg;
        if (inlineStatus) inlineStatus.textContent = msg;
        if (btn) { btn.disabled = false; btn.textContent = "Save thumbnail"; }
      }
    }

    async function regen(source, lang, platform) {
      const text = source === "companion"
        ? (lang === "es" ? S.runData.companionEs : S.runData.companionEn)
        : (lang === "es" ? S.runData.reflectionEs : S.runData.reflectionEn);
      const title = source === "companion" ? (S.runData.companionTitle || S.runData.title) : S.runData.title;
      if (!text) {
        alert("Source text not available.");
        return;
      }
      const data = await j("/api/pipeline/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          source_text: text,
          title,
          article_url: S.runData.url,
          language: lang === "es" ? "Spanish" : "english",
          tone_level: parseInt($("tone").value, 10) || 5
        })
      });
      const bucket = S.runData.socials[source][lang] || {};
      bucket[platform] = data.content || "";
      syncSocial(source, lang, bucket);
      view("pipe");
      view("mk");
    }

    async function publishSocial(platform, id, btn) {
      btn.disabled = true;
      const orig = btn.textContent;
      btn.textContent = "Publishing…";
      try {
        await j("/api/social/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, text: getElPlainText($(id)), source_label: btn.dataset.label || "" })
        });
        btn.textContent = "✓ Published";
      } catch (e) {
        btn.textContent = "Error";
        btn.title = e.message || "Publish failed";
        btn.disabled = false;
      }
    }

    function copyText(value, btn) {
      navigator.clipboard.writeText(value || "");
      const label = btn.dataset.resetLabel || btn.textContent || btn.getAttribute("aria-label") || btn.title || "Copy";
      if (btn.textContent) btn.textContent = "Copied";
      else {
        btn.setAttribute("aria-label", "Copied");
        btn.title = "Copied";
      }
      setTimeout(() => {
        if (btn.textContent) btn.textContent = label;
        else {
          btn.setAttribute("aria-label", label);
          btn.title = label;
        }
      }, 900);
    }

    function getElText(el) {
      if (!el) return "";
      if (el.isContentEditable) return el.innerHTML;
      return el.value !== undefined ? el.value : el.textContent || "";
    }
    // Plain text version — use for schedule/publish API calls
    function getElPlainText(el) {
      if (!el) return "";
      if (el.isContentEditable) return el.innerText;
      return el.value !== undefined ? el.value : el.textContent || "";
    }

    // Converts RTE innerHTML back to markdown for DB storage.
    // Reverses renderMarkdown() + handles RTE toolbar tags (<b>, <i>).
    function htmlToMarkdown(html) {
      const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');

      function walk(node) {
        if (node.nodeType === 3) return node.textContent; // text node
        if (node.nodeType !== 1) return '';
        const tag = node.tagName.toLowerCase();
        const kids = () => Array.from(node.childNodes).map(walk).join('');

        switch (tag) {
          case 'b': case 'strong': return '**' + kids() + '**';
          case 'i': case 'em':    return '_' + kids() + '_';
          case 'code':            return '`' + node.textContent + '`';
          case 'a': {
            const href = node.getAttribute('href') || '';
            return '[' + kids() + '](' + href + ')';
          }
          case 'br': return '\n';
          case 'hr': return '\n---\n';
          case 'pre': return '```\n' + node.textContent + '\n```';
          case 'p':   return kids().trim() + '\n\n';
          case 'h1':  return '# '   + kids().trim() + '\n\n';
          case 'h2':  return '## '  + kids().trim() + '\n\n';
          case 'h3':  return '### ' + kids().trim() + '\n\n';
          case 'h4':  return '#### '+ kids().trim() + '\n\n';
          case 'blockquote':
            return kids().trim().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
          case 'ul':
            return Array.from(node.children)
              .map(li => '- ' + Array.from(li.childNodes).map(walk).join('').trim())
              .join('\n') + '\n\n';
          case 'ol':
            return Array.from(node.children)
              .map((li, i) => (i + 1) + '. ' + Array.from(li.childNodes).map(walk).join('').trim())
              .join('\n') + '\n\n';
          case 'li':  return kids(); // handled by ul/ol
          case 'div': { const c = kids(); return c + (c.endsWith('\n') ? '' : '\n'); }
          default:    return kids();
        }
      }

      return walk(doc.querySelector('div')).trim().replace(/\n{3,}/g, '\n\n');
    }

    function copy(id, btn) {
      const el = $(id);
      copyText(el ? (el.value !== undefined ? el.value : el.innerText || el.textContent) || "" : "", btn);
    }

    function repurposeFromExisting(id, source, lang, platform) {
      const text = $(id).value.trim();
      if (!text) return;
      mode("marketing");
      setMarketingTab("studio");
      $("mk-gen-title").value = source === "companion" ? (S.runData.companionTitle || S.runData.title || "Marketing asset") : (S.runData.title || "Marketing asset");
      $("mk-gen-slug").value = slug($("mk-gen-title").value);
      $("mk-gen-url").value = S.runData.url || "";
      $("mk-gen-date").value = "";
      $("mk-gen-angle").value = "Derived from " + PL[platform] + " / " + lang.toUpperCase();
      $("mk-gen-lang").value = lang === "es" ? "Spanish" : "english";
      $("mk-gen-text").value = "[Marketing source]\nSource: " + source + "\nPlatform: " + PL[platform] + "\nLanguage: " + lang.toUpperCase() + "\n\n" + text;
      $("mk-generator-card").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function dl(text, filename) {
      const blob = new Blob([text || ""], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "document.md";
      a.click();
      URL.revokeObjectURL(url);
    }

    function rt(name) {
      document.querySelectorAll("[data-rt]").forEach(button => button.classList.toggle("active", button.dataset.rt === name));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === "p-" + name));
    }

    function lg(group, lang) {
      if (group === "global") {
        lg("ref", lang);
        lg("comp", lang);
        document.querySelectorAll('[data-lg="global"]').forEach(button => button.classList.toggle("active", button.dataset.lang === lang));
        return;
      }
      document.querySelectorAll('[data-lg="' + group + '"]').forEach(button => button.classList.toggle("active", button.dataset.lang === lang));
      const map = { ref: ["ref-en", "ref-es"], comp: ["comp-en", "comp-es"], co: ["co-en", "co-es"] };
      (map[group] || []).forEach(id => $(id).classList.toggle("active", id.endsWith("-" + lang)));
    }

    function bindDropzone(dropId, inputId, onFile) {
      const drop = $(dropId);
      const input = $(inputId);
      drop.onclick = () => input.click();
      drop.ondragover = e => { e.preventDefault(); drop.classList.add("drag"); };
      drop.ondragleave = () => drop.classList.remove("drag");
      drop.ondrop = async e => {
        e.preventDefault();
        drop.classList.remove("drag");
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) await onFile(file);
      };
    }

    function init() {
      setTheme(S.theme);
      tone();
      setRun("", "");
      resetPipelineTasks();
      ["ref-en", "ref-es", "comp-en", "comp-es", "co-en", "co-es"].forEach(id => doc(id, "", "document.md"));
      ["pipe", "mk"].forEach(scope => ["reflection", "companion"].forEach(source => ["en", "es"].forEach(lang => social(scope, source, lang, null))));
      thRender();
      setThumbTab("studio");
      setMarketingTab("library");
      ["voice", "comp", "es", "th"].forEach(target => setMdView(target, "edit"));
      view("pipe");
      view("mk");
      validPipe();
    }

    document.addEventListener("click", e => {
      const blocked = e.target.closest(".role-disabled");
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        authError(blocked.dataset.roleTooltip || roleMessage(blocked.dataset.minRole || "admin"));
      }
    }, true);

    document.addEventListener("click", e => {
      const action = e.target.closest("[data-a]");
      if (action) {
        const kind = action.dataset.a;
        const minRole = requiredRoleForAction(action);
        if (minRole && !hasRole(minRole)) {
          authError(roleMessage(minRole));
          return;
        }
        const menu = action.closest("details");
        if (kind === "dl") dl(decodeURIComponent(action.dataset.text || ""), decodeURIComponent(action.dataset.file || "document.md"));
        else if (kind === "copy") copy(action.dataset.id, action);
        else if (kind === "copy-doc") copyText(decodeURIComponent(action.dataset.text || ""), action);
        else if (kind === "doc-view") setDocView(action.dataset.id, action.dataset.view);
        else if (kind === "mk-select") selectMarketingRun(action.dataset.id);
        else if (kind === "pick-concept") {
          S.thumbConceptSelected = action.dataset.index;
          thRender();
        }
        else if (kind === "repurpose") repurposeFromExisting(action.dataset.id, action.dataset.source, action.dataset.lang, action.dataset.platform);
        else if (kind === "social-publish") publishSocial(action.dataset.platform, action.dataset.id, action);
        else if (kind === "regen") regen(action.dataset.source, action.dataset.lang, action.dataset.platform);
        else if (kind === "open-run") openRun(action.dataset.id, action.dataset.mode);
        else if (kind === "open-thumb") openThumb(action.dataset.id);
        else if (kind === "del-run") j("/api/history/" + action.dataset.id, { method: "DELETE" }).then(() => { loadHist(); loadMk(); loadDash(); });
        else if (kind === "idea-status") j("/api/ideas/" + action.dataset.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.dataset.status })
        }).then(loadIdeas);
        else if (kind === "idea-del") j("/api/ideas/" + action.dataset.id, { method: "DELETE" }).then(loadIdeas);
        else if (kind === "sn-new-post") { snNewPost(); }
        else if (kind === "sn-filter") {
          const f = action.dataset.filter;
          if (f === "shared")       S.snSearch.shared    = !S.snSearch.shared;
          else if (f === "repurposed") S.snSearch.repurposed = !S.snSearch.repurposed;
          else if (f === "signal-pos") S.snSearch.signal = S.snSearch.signal === "positive" ? "" : "positive";
          else if (f === "signal-neg") S.snSearch.signal = S.snSearch.signal === "negative" ? "" : "negative";
          action.classList.toggle("active",
            f === "shared"      ? S.snSearch.shared :
            f === "repurposed"  ? S.snSearch.repurposed :
            f === "signal-pos"  ? S.snSearch.signal === "positive" :
                                  S.snSearch.signal === "negative"
          );
          snDoSearch();
        }
        else if (kind === "sn-batch-toggle") {
          const bid = action.dataset.bid;
          if (S.snOpenBatches[bid]) {
            delete S.snOpenBatches[bid];
            snBatchRailRender();
          } else {
            S.snOpenBatches[bid] = true;
            snBatchRailRender();
            if (!S.snBatchNotesCache[bid]) {
              const notesEl = $("sn-batch-notes-" + bid);
              if (notesEl) notesEl.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Loading…</div>';
              j("/api/substack-notes/batches/" + bid).then(d => {
                S.snBatchNotesCache[bid] = d.notes || [];
                const el2 = $("sn-batch-notes-" + bid);
                if (el2) el2.innerHTML = _snBatchNotesListHtml(bid, S.snBatchNotesCache[bid]);
              });
            }
          }
        }
        else if (kind === "aud-sync") {
          syncSubscribers();
        }
        else if (kind === "aud-tab") {
          const tab = action.dataset.tab;
          document.querySelectorAll('[data-a="aud-tab"]').forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
          $("aud-pane-browser").style.display  = tab === "browser"  ? "" : "none";
          $("aud-pane-insights").style.display = tab === "insights" ? "" : "none";
        }
        else if (kind === "aud-insights-load") {
          loadInsights();
        }
        else if (kind === "ins-rec-tab") {
          _insRecTab = action.dataset.tab;
          document.querySelectorAll('[data-a="ins-rec-tab"]').forEach(b => b.classList.toggle("active", b.dataset.tab === _insRecTab));
          const body = $("aud-insights-body");
          if (!body || !body.dataset.recs) return;
          const recs = JSON.parse(body.dataset.recs);
          const list = recs.filter(r => r.type === _insRecTab);
          const cards = $("ins-rec-cards");
          if (cards) cards.innerHTML = list.map(r =>
            '<div class="ins-rec-card ' + H(r.type) + '">' +
              '<div class="ins-rec-title">' + H(r.title) + '</div>' +
              '<div class="ins-rec-action">' + H(r.action) + '</div>' +
              '<div class="ins-rec-why">' + H(r.why) + '</div>' +
            '</div>'
          ).join("");
        }
        else if (kind === "aud-sub-open") {
          openSubscriberDetail(action.dataset.email);
        }
        else if (kind === "aud-filt") {
          const filt = action.dataset.filt;
          if (filt === "paid") {
            audBrState.interval = audBrState.interval === "paid" ? "" : "paid";
          } else if (filt === "free") {
            audBrState.interval = audBrState.interval === "free" ? "" : "free";
          } else if (filt === "r5") {
            audBrState.activity = audBrState.activity === 5 ? null : 5;
          } else if (filt === "r4") {
            audBrState.activity = audBrState.activity === 4 ? null : 4;
          }
          // Update pill states
          document.querySelectorAll(".aud-filter-pill").forEach(p => {
            const f = p.dataset.filt;
            const on = (f === "paid" && audBrState.interval === "paid") ||
                       (f === "free" && audBrState.interval === "free") ||
                       (f === "r5"   && audBrState.activity === 5) ||
                       (f === "r4"   && audBrState.activity === 4);
            p.classList.toggle("active", on);
          });
          audBrState.offset = 0;
          loadAudienceList();
        }
        else if (kind === "aud-page") {
          const dir = parseInt(action.dataset.dir) || 1;
          audBrState.offset = Math.max(0, audBrState.offset + dir * audBrState.limit);
          loadAudienceList();
        }
        else if (kind === "sn-batch-del") {
          const bid = action.dataset.bid;
          if (!confirm("Delete batch #" + bid + " and all its notes?")) return;
          j("/api/substack-notes/batches/" + bid, { method: "DELETE" }).then(() => {
            delete S.snBatchNotesCache[bid];
            delete S.snOpenBatches[bid];
            if (S.snSelectedNote) {
              const notesInBatch = S.snBatchNotesCache[bid] || [];
              if (notesInBatch.some(n => String(n.id) === String(S.snSelectedNote.id))) {
                S.snSelectedNote = null;
                snShowPanel("empty");
              }
            }
            loadSnBatches();
          });
        }
        else if (kind === "sn-batch-show-all") {
          const bid = action.dataset.bid;
          S.snBatchShowAll[bid] = true;
          const notesEl = $("sn-batch-notes-" + bid);
          if (notesEl) notesEl.innerHTML = _snBatchNotesListHtml(bid, S.snBatchNotesCache[bid] || []);
        }
        else if (kind === "sn-note-open") {
          const nid = action.dataset.nid;
          const bid = action.dataset.bid;
          const notes = S.snBatchNotesCache[bid] || [];
          const note = notes.find(n => String(n.id) === String(nid));
          if (note) snOpenNote(note);
        }
        else if (kind === "sn-shared") {
          const val = action.dataset.val === "1";
          const nid = action.dataset.id;
          j("/api/substack-notes/" + nid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shared: val })
          }).then(() => {
            // Update cache
            for (const bid in S.snBatchNotesCache) {
              const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(nid));
              if (n) { n.shared = val ? 1 : 0; break; }
            }
            if (S.snSelectedNote && String(S.snSelectedNote.id) === String(nid)) {
              S.snSelectedNote.shared = val ? 1 : 0;
              snNoteDetailRender();
            }
          });
        }
        else if (kind === "sn-signal") {
          const val = action.dataset.val;
          const nid = action.dataset.id;
          let cachedNote = null;
          for (const bid in S.snBatchNotesCache) {
            cachedNote = S.snBatchNotesCache[bid].find(n => String(n.id) === String(nid));
            if (cachedNote) break;
          }
          const newVal = (cachedNote && cachedNote.signal === val) ? "none" : val;
          j("/api/substack-notes/" + nid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signal: newVal })
          }).then(() => {
            if (cachedNote) cachedNote.signal = newVal;
            if (S.snSelectedNote && String(S.snSelectedNote.id) === String(nid)) {
              S.snSelectedNote.signal = newVal;
              snNoteDetailRender();
            }
          });
        }
        else if (kind === "sn-edit-open") {
          const id = action.dataset.id;
          const edit = $("sn-edit-" + id);
          const ta = $("sn-edit-ta-" + id);
          const preview = $("sn-edit-preview-" + id);
          if (!edit || !ta) return;
          edit.classList.add("open");
          // Hide platform tabs while editing
          const detail = $("sn-note-detail");
          if (detail) {
            const platBar = detail.querySelector(".sn-plat-bar");
            if (platBar) platBar.style.display = "none";
            detail.querySelectorAll(".sn-plat-panel").forEach(p => p.style.display = "none");
          }
          if (preview) {
            preview.innerHTML = renderMarkdown(ta.value);
            ta.oninput = () => { preview.innerHTML = renderMarkdown(ta.value); };
          }
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
        else if (kind === "sn-edit-cancel") {
          const id = action.dataset.id;
          const edit = $("sn-edit-" + id);
          const ta = $("sn-edit-ta-" + id);
          if (!edit || !ta) return;
          if (S.snSelectedNote && String(S.snSelectedNote.id) === String(id)) ta.value = S.snSelectedNote.note_text;
          edit.classList.remove("open");
          // Restore platform tabs
          const detail = $("sn-note-detail");
          if (detail) {
            const platBar = detail.querySelector(".sn-plat-bar");
            if (platBar) platBar.style.display = "";
            detail.querySelectorAll(".sn-plat-panel").forEach(p => { p.style.display = ""; });
            const activePanel = detail.querySelector(".sn-plat-panel.active");
            if (activePanel) activePanel.style.display = "block";
          }
        }
        else if (kind === "sn-edit-save") {
          const id = action.dataset.id;
          const ta = $("sn-edit-ta-" + id);
          const edit = $("sn-edit-" + id);
          if (!ta) return;
          const newText = ta.value.trim();
          if (!newText) return;
          action.disabled = true; action.textContent = "Saving…";
          j("/api/substack-notes/" + id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note_text: newText })
          }).then(() => {
            // Update cache and selected note
            for (const bid in S.snBatchNotesCache) {
              const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(id));
              if (n) { n.note_text = newText; break; }
            }
            if (S.snSelectedNote && String(S.snSelectedNote.id) === String(id)) {
              S.snSelectedNote.note_text = newText;
            }
            if (edit) edit.classList.remove("open");
            action.disabled = false; action.textContent = "Save";
            // Re-render to update the SN textarea
            snNoteDetailRender();
          }).catch(e => {
            action.disabled = false; action.textContent = "Save";
            alert("Save failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "sn-promote") {
          j("/api/substack-notes/" + action.dataset.id + "/promote", { method: "POST" })
            .then(() => {
              action.textContent = "✓ Added";
              action.disabled = true;
            }).catch(e => alert("Promote failed: " + e.message));
        }
        else if (kind === "sn-repurpose") {
          const nid = action.dataset.id;
          action.disabled = true;
          action.textContent = "Generating…";
          j("/api/substack-notes/" + nid + "/repurpose", { method: "POST" })
            .then(data => {
              // Update cache
              for (const bid in S.snBatchNotesCache) {
                const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(nid));
                if (n) {
                  n.linkedin_post = data.linkedin || "";
                  n.threads_post = data.threads || "";
                  n.instagram_post = data.instagram || "";
                  break;
                }
              }
              if (S.snSelectedNote && String(S.snSelectedNote.id) === String(nid)) {
                S.snSelectedNote.linkedin_post = data.linkedin || "";
                S.snSelectedNote.threads_post = data.threads || "";
                S.snSelectedNote.instagram_post = data.instagram || "";
                snNoteDetailRender();
              }
            }).catch(e => {
              action.disabled = false;
              action.textContent = "Generate →";
              alert("Repurpose failed: " + e.message);
            });
        }
        else if (kind === "sn-plat-tab") {
          const nid = action.dataset.nid;
          const plat = action.dataset.plat;
          const detail = $("sn-note-detail");
          if (!detail) return;
          detail.querySelectorAll(".sn-plat-btn").forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
          detail.querySelectorAll(".sn-plat-panel").forEach(p => {
            const active = p.id === "sn-det-panel-" + nid + "-" + plat;
            p.classList.toggle("active", active);
            p.style.display = active ? "block" : "none";
          });
        }
        else if (kind === "mk-plat-tab") {
          const plat = action.dataset.plat;
          const preview = $("mk-library-preview");
          if (!preview) return;
          preview.querySelectorAll(".sn-plat-btn").forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
          preview.querySelectorAll(".sn-plat-panel").forEach(p => {
            const active = p.dataset.plat === plat;
            p.classList.toggle("active", active);
            p.style.display = active ? "block" : "none";
          });
        }
        else if (kind === "cmp-platform") { snComposeSelectPlatform(action.dataset.plat); }
        else if (kind === "cmp-repurpose") { snComposeRepurpose(action); }
        else if (kind === "cmp-start-over") {
          S.compose.repurpose = null;
          snComposeRender();
        }
        else if (kind === "sn-note-save") {
          const nid = action.dataset.nid;
          const textId = action.dataset.textId;
          const ta = $(textId);
          if (!ta) return;
          const newText = (ta.isContentEditable ? htmlToMarkdown(ta.innerHTML) : ta.value).trim();
          if (!newText) return;
          action.disabled = true; action.textContent = "Saving…";
          j("/api/substack-notes/" + nid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note_text: newText })
          }).then(() => {
            for (const bid in S.snBatchNotesCache) {
              const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(nid));
              if (n) { n.note_text = newText; break; }
            }
            if (S.snSelectedNote && String(S.snSelectedNote.id) === String(nid)) {
              S.snSelectedNote.note_text = newText;
            }
            action.disabled = false; action.textContent = "Saved ✓";
            setTimeout(() => { if (action.textContent === "Saved ✓") action.textContent = "Save"; }, 1800);
          }).catch(e => {
            action.disabled = false; action.textContent = "Save";
            alert("Save failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "sn-rep-thumb") {
          const issue = decodeURIComponent(action.dataset.issue || "");
          mode("thumbnail");
          pipelineSource && pipelineSource("paste");
          const titleEl = $("th-title");
          const textEl = $("th-text");
          if (titleEl) titleEl.value = issue;
          if (textEl) textEl.value = issue;
        }
        else if (kind === "idea-write") {
          const idea = S.ideas.find(v => String(v.id) === String(action.dataset.id));
          if (idea) {
            mode("marketing");
            setMarketingTab("studio");
            $("mk-gen-title").value = idea.article_angle || idea.theme || "";
            $("mk-gen-slug").value = slug($("mk-gen-title").value);
            $("mk-gen-url").value = "";
            $("mk-gen-date").value = "";
            $("mk-gen-angle").value = idea.article_angle || "";
            $("mk-gen-text").value = "[Ideas Pool]\nTheme: " + (idea.theme || "") + "\nCategory: " + (idea.category || "") + "\nAngle: " + (idea.article_angle || "");
            j("/api/ideas/" + idea.id, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "writing" })
            }).then(loadIdeas);
          }
        } else if (kind === "queue-pipeline") {
          const title = decodeURIComponent(action.dataset.title || "");
          const url = decodeURIComponent(action.dataset.url || "");
          mode("pipeline");
          pipelineSource("paste");
          $("article-title").value = title;
          $("article-slug").value = slug(title);
          $("article-url").value = url;
          if (url) {
            $("reflection-text").value = "Fetching article content…";
            validPipe();
            j("/api/articles/fetch?url=" + encodeURIComponent(url)).then(data => {
              $("article-title").value = data.title || title;
              $("article-slug").value = slug($("article-title").value);
              $("reflection-text").value = data.markdown || "";
              validPipe();
            }).catch(() => {
              $("reflection-text").value = "";
              validPipe();
            });
          } else {
            validPipe();
          }
        } else if (kind === "queue-use") {
          mode("marketing");
          setMarketingTab("studio");
          const title = decodeURIComponent(action.dataset.title || "");
          const url = decodeURIComponent(action.dataset.url || "");
          $("mk-gen-title").value = title;
          $("mk-gen-slug").value = slug(title);
          $("mk-gen-url").value = url;
          $("mk-gen-status").textContent = "Fetching article content...";
          if (url) {
            j("/api/articles/fetch?url=" + encodeURIComponent(url)).then(data => {
              $("mk-gen-title").value = data.title || title;
              $("mk-gen-slug").value = slug($("mk-gen-title").value);
              $("mk-gen-text").value = data.markdown || "";
              $("mk-gen-status").textContent = "Article loaded from queue.";
            }).catch(err => {
              $("mk-gen-status").textContent = err.message || "Could not fetch article content.";
            });
          }
          $("mk-generator-card").scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (kind === "idea-pipeline") {
          const idea = S.ideas.find(v => String(v.id) === String(action.dataset.id));
          if (idea) {
            mode("pipeline");
            pipelineSource("paste");
            $("article-title").value = idea.article_angle || idea.theme || "";
            $("article-slug").value = slug($("article-title").value);
            $("reflection-text").value = "[Idea]\nTheme: " + (idea.theme || "") + "\nCategory: " + (idea.category || "") + "\nAngle: " + (idea.article_angle || "");
            validPipe();
          }
        } else if (kind === "goto-marketing") { mode("marketing"); setMarketingTab("library"); }
        else if (kind === "save-thumb") saveThumb(action.dataset.index);
        else if (kind === "dl-thumb") {
          let b64 = null;
          if (action.dataset.draftIndex !== undefined) {
            const concept = (S.thumbDraft.concepts || []).find(v => Number(v.index) === Number(action.dataset.draftIndex));
            b64 = concept ? concept.image_b64 : null;
          } else {
            b64 = S.thumbSelected ? S.thumbSelected.image_b64 : null;
          }
          if (!b64) return;
          const a = document.createElement("a");
          a.href = "data:image/png;base64," + b64;
          a.download = (action.dataset.name || "thumbnail") + ".png";
          a.click();
        }
        else if (kind === "qt-copy") {
          navigator.clipboard.writeText(action.dataset.text || "").catch(() => {});
          const orig = action.textContent; action.textContent = "Copied!"; setTimeout(() => action.textContent = orig, 1500);
        }
        else if (kind === "qt-run-select") {
          const run = S.quotesRuns.find(r => String(r.run_id) === String(action.dataset.runId));
          if (run) selectQuotesRun(run);
        }
        else if (kind === "qt-shared") {
          const qid = parseInt(action.dataset.qid);
          const q = S.quotesData.find(x => x.id === qid);
          if (q) {
            const newVal = !q.shared;
            j("/api/quotes/" + qid, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shared: newVal })
            }).then(() => { q.shared = newVal ? 1 : 0; quoteDetailRender(); });
          }
        }
        else if (kind === "qt-signal-pos" || kind === "qt-signal-neg") {
          const qid = parseInt(action.dataset.qid);
          const q = S.quotesData.find(x => x.id === qid);
          if (q) {
            const newVal = (kind === "qt-signal-pos" ? (q.signal === "positive" ? "none" : "positive") : (q.signal === "negative" ? "none" : "negative"));
            j("/api/quotes/" + qid, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ signal: newVal })
            }).then(() => { q.signal = newVal; quoteDetailRender(); });
          }
        }
        else if (kind === "qt-repurpose") {
          const qid = parseInt(action.dataset.qid);
          const orig = action.textContent;
          action.textContent = "Generating…"; action.disabled = true;
          j("/api/quotes/" + qid + "/repurpose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quote_text: decodeURIComponent(action.dataset.quote || ""),
              context: decodeURIComponent(action.dataset.context || ""),
              article_title: decodeURIComponent(action.dataset.title || ""),
              article_url: decodeURIComponent(action.dataset.url || "")
            })
          }).then(res => {
            const q = S.quotesData.find(x => x.id === qid);
            if (q) { q.linkedin_post = res.linkedin; q.threads_post = res.threads; q.instagram_post = res.instagram; }
            quoteDetailRender();
          }).catch(e => {
            action.textContent = orig; action.disabled = false;
            alert("Repurpose failed: " + e.message);
          });
        }
        else if (kind === "qt-rep-tab") {
          const qid = action.dataset.qid;
          const plat = action.dataset.plat;
          document.querySelectorAll('[data-a="qt-rep-tab"][data-qid="' + qid + '"]').forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
          document.querySelectorAll('[id^="qt-rp-' + qid + '-"]').forEach(p => p.classList.toggle("active", p.id === "qt-rp-" + qid + "-" + plat));
        }
        else if (kind === "qt-rep-publish") {
          const text = action.dataset.text || "";
          const platform = action.dataset.plat;
          if (!text) return;
          const orig = action.textContent;
          action.textContent = "Publishing…"; action.disabled = true;
          j("/api/social/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, text, source_label: action.dataset.label || "Quote" })
          }).then(() => {
            action.textContent = "✓ Published";
            setTimeout(() => {
              setMarketingTab("scheduled");
              loadPublishedFeed();
            }, 600);
          }).catch(e => {
            action.textContent = orig; action.disabled = false;
            alert("Publish failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "qt-promote") {
          j("/api/quotes/" + action.dataset.qid + "/promote", { method: "POST" })
            .then(() => { action.textContent = "✓ Added"; action.disabled = true; })
            .catch(e => alert("Promote failed: " + e.message));
        }
        else if (kind === "sched-open") {
          const picker = $(action.dataset.picker);
          if (!picker) return;
          picker.classList.toggle("open");
          // Pre-fill with a sensible default: tomorrow at 09:00 local time
          const dt = $(action.dataset.picker.replace("sched-pk-", "sched-dt-"));
          if (dt && !dt.value) {
            const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
            const pad = n => String(n).padStart(2, "0");
            dt.value = d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
          }
        }
        else if (kind === "sched-cancel") {
          const picker = $(action.dataset.picker);
          if (picker) picker.classList.remove("open");
        }
        else if (kind === "sched-confirm") {
          const dtInput = $("sched-dt-" + action.dataset.id);
          const text = getElPlainText($(action.dataset.id));
          const dt = dtInput ? dtInput.value : "";
          if (!dt || !text.trim()) return;
          const tzSel = $("sched-tz-" + action.dataset.id);
          const tz = tzSel ? tzSel.value : "";
          const scheduledAt = tzToUtcIso(dt, tz);   // stored as UTC ISO
          const tzName = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const orig = action.textContent;
          action.textContent = "Scheduling…"; action.disabled = true;
          const platform = action.dataset.platform;
          const noteIdMatch = platform === "substack_note" && action.dataset.id.match(/sn-sched-txt-(\d+)/);
          let imageUrl = "";
          if (platform === "instagram") {
            const imgInput = $("sched-img-url-" + action.dataset.id);
            imageUrl = imgInput ? imgInput.value.trim() : "";
            if (!imageUrl) {
              action.textContent = orig; action.disabled = false;
              alert("Instagram requires a public image URL. Generate an image and paste its public URL.");
              return;
            }
          }
          j("/api/social/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              text: text.trim(),
              scheduled_at: scheduledAt,
              timezone: tzName,
              source_label: action.dataset.label || "",
              ...(imageUrl ? { image_url: imageUrl } : {}),
              ...(noteIdMatch ? { note_id: parseInt(noteIdMatch[1]) } : {}),
            })
          }).then(() => {
            action.textContent = "✓ Scheduled";
            const picker = $("sched-pk-" + action.dataset.id);
            if (picker) picker.classList.remove("open");
          }).catch(e => {
            action.textContent = orig; action.disabled = false;
            alert("Schedule failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "sn-sa-open") {
          const panel = $(action.dataset.panel);
          if (panel) panel.classList.toggle("open");
        }
        else if (kind === "sn-sa-cancel") {
          const panel = $(action.dataset.panel);
          if (panel) panel.classList.remove("open");
        }
        else if (kind === "sn-sa-toggle") {
          action.classList.toggle("active");
        }
        else if (kind === "sn-sa-confirm") {
          const panel = $(action.dataset.panel);
          if (!panel) return;
          const dtInput = panel.querySelector(".sn-sa-dt");
          const tzSel = panel.querySelector(".sn-sa-tz");
          const dt = dtInput ? dtInput.value : "";
          if (!dt) { alert("Pick a date and time first."); return; }
          const tz = tzSel ? tzSel.value : "";
          const scheduledAt = tzToUtcIso(dt, tz);
          const tzName = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const noteId = panel.dataset.noteId ? parseInt(panel.dataset.noteId) : null;
          const pills = panel.querySelectorAll("[data-a='sn-sa-toggle']");
          const selected = Array.from(pills).filter(p => p.classList.contains("active"));
          if (!selected.length) { alert("Select at least one platform."); return; }
          const orig = action.textContent;
          action.textContent = "Scheduling…"; action.disabled = true;
          const tasks = selected.map(pill => {
            const platform = pill.dataset.plat;
            const textEl = $(pill.dataset.textId);
            const text = textEl ? getElPlainText(textEl).trim() : "";
            if (!text) return Promise.resolve(null);
            return j("/api/social/schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform,
                text,
                scheduled_at: scheduledAt,
                timezone: tzName,
                source_label: "Compose",
                ...(noteId && platform === "substack_note" ? { note_id: noteId } : {}),
              })
            });
          });
          Promise.all(tasks).then(() => {
            action.textContent = "✓ Scheduled";
            setTimeout(() => { if (panel) panel.classList.remove("open"); action.textContent = orig; action.disabled = false; }, 1500);
          }).catch(e => {
            action.textContent = orig; action.disabled = false;
            alert("Schedule failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "sched-del") {
          j("/api/social/scheduled/" + action.dataset.id, { method: "DELETE" })
            .then(loadScheduledQueue);
        }
        else if (kind === "sched-hard-del") {
          j("/api/social/scheduled/" + action.dataset.id + "/hard", { method: "DELETE" })
            .then(loadScheduledQueue);
        }
        else if (kind === "sched-gen-image") {
          const textId = action.dataset.textId;
          const promptEl = $("sched-img-prompt-" + textId);
          const previewEl = $("sched-img-preview-" + textId);
          const textEl = $(textId);
          const postText = textEl ? (textEl.value || textEl.textContent || "").trim() : "";
          const prompt = promptEl ? promptEl.value.trim() : "";
          const orig = action.textContent;
          action.textContent = "Generating…"; action.disabled = true;
          j("/api/imagen/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_text: postText, prompt })
          }).then(data => {
            action.textContent = orig; action.disabled = false;
            if (promptEl && data.prompt_used) promptEl.value = data.prompt_used;
            if (previewEl) {
              previewEl.innerHTML = '<img src="' + H(data.local_url) + '" alt="Generated image">';
              previewEl.classList.add("show");
            }
          }).catch(e => {
            action.textContent = orig; action.disabled = false;
            alert("Image generation failed: " + (e.message || "unknown error"));
          });
        }
        else if (kind === "sched-signal") {
          const noteId = action.dataset.noteId;
          const val = action.dataset.val;
          const isActive = (val === "positive" && action.classList.contains("active-pos")) ||
                           (val === "negative" && action.classList.contains("active-neg"));
          const newVal = isActive ? "none" : val;
          j("/api/substack-notes/" + noteId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signal: newVal })
          }).then(() => {
            // Update button state optimistically in the queue row
            const row = action.closest(".sched-item");
            row.querySelectorAll(".sched-signal-btn").forEach(b => b.classList.remove("active-pos", "active-neg"));
            if (newVal === "positive") action.classList.add("active-pos");
            else if (newVal === "negative") action.classList.add("active-neg");
          });
        }
        else if (kind === "del-thumb") j("/api/thumbnails/" + action.dataset.id, { method: "DELETE" }).then(() => {
          if (S.thumbSelected && String(S.thumbSelected.id) === String(action.dataset.id)) {
            S.thumbSelected = null;
            renderThumbDetail();
          }
          loadThumbs();
        });
        if (action.dataset.closeMenu && menu) menu.open = false;
        return;
      }

      if (e.target.id === "run-meta-view" || e.target.closest("#run-meta-view")) {
        mode("history");
        return;
      }

      const nav = e.target.closest("[data-mode]");
      if (nav) {
        mode(nav.dataset.mode);
        return;
      }

      const tab = e.target.closest("[data-rt]");
      if (tab) {
        rt(tab.dataset.rt);
        return;
      }

      const stageRt = e.target.closest("[data-stage-rt]");
      if (stageRt && (stageRt.classList.contains("done") || stageRt.classList.contains("skipped"))) {
        const key = stageRt.dataset.stageKey;
        if (key === "thumbnail") { mode("thumbnail"); }
        else if (key === "reflection_social" || key === "companion_social") { mode("marketing"); setMarketingTab("library"); }
        else if (key === "reflection_es") { rt("reflection"); lg("global", "es"); $("results").scrollIntoView({ behavior: "smooth", block: "start" }); }
        else { rt(stageRt.dataset.stageRt); $("results").scrollIntoView({ behavior: "smooth", block: "start" }); }
        return;
      }

      const mdView = e.target.closest("[data-md-view]");
      if (mdView) {
        setMdView(mdView.dataset.mdTarget, mdView.dataset.mdView);
        return;
      }

      const thumbTab = e.target.closest("[data-th-tab]");
      if (thumbTab) {
        setThumbTab(thumbTab.dataset.thTab);
        return;
      }

      const marketingTab = e.target.closest("[data-mk-tab]");
      if (marketingTab) {
        setMarketingTab(marketingTab.dataset.mkTab);
        return;
      }

      const lang = e.target.closest("[data-lg]");
      if (lang) {
        lg(lang.dataset.lg, lang.dataset.lang);
        return;
      }

      const scope = e.target.closest("[data-scope]");
      if (scope) {
        S.social[scope.dataset.scope][scope.dataset.kind] = scope.dataset.val;
        view(scope.dataset.scope);
        return;
      }

      const socTab = e.target.closest("[data-soc-tab]");
      if (socTab) {
        const bar = socTab.closest(".soc-tab-bar");
        const shell = socTab.closest(".soc-shell");
        if (!bar || !shell) return;
        bar.querySelectorAll(".soc-tab").forEach(b => b.classList.remove("active"));
        socTab.classList.add("active");
        shell.querySelectorAll(".soc-panel").forEach(p => p.classList.toggle("active", p.dataset.platform === socTab.dataset.socTab));
        return;
      }

      const mkAsset = e.target.closest("[data-mk-src]");
      if (mkAsset) {
        S.mkView = { source: mkAsset.dataset.mkSrc, lang: mkAsset.dataset.mkLang };
        renderMkReadingPane();
        return;
      }

      const rteBtn = e.target.closest("[data-rte-cmd]");
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

      const navBtn = e.target.closest(".mk-nav-btn");
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
        return;
      }
    });

    document.addEventListener("input", e => {
      const t = e.target;
      if (t.classList.contains("social-text") && t.dataset.socCount) {
        const el = document.getElementById(t.dataset.socCount);
        if (el) {
          const len = t.value.length;
          const max = parseInt(t.dataset.socMax || "0", 10);
          el.textContent = len + (max ? " / " + max : " chars");
          el.classList.toggle("near-limit", max > 0 && len > max * 0.9);
          el.classList.toggle("over-limit", max > 0 && len > max);
        }
      }
    });

    document.addEventListener("DOMContentLoaded", async () => {
      setTheme(S.theme);
      init();
      new MutationObserver(() => scheduleRoleUiRefresh()).observe(document.body, { childList: true, subtree: true });
      scheduleRoleUiRefresh();

      $("theme-btn").onclick = () => setTheme(S.theme === "dark" ? "light" : "dark");
      $("login-btn").onclick = login;
      $("logout-btn").onclick = logout;
      $("create-user-btn").onclick = createUser;
      $("login-password").addEventListener("keydown", e => {
        if (e.key === "Enter") login();
      });
      $("open-run").onclick = () => {
        mode("pipeline");
        ($("results").classList.contains("hide") ? $("progress") : $("results")).scrollIntoView({ behavior: "smooth", block: "start" });
      };

      $("src-file").onclick = () => pipelineSource("file");
      $("src-paste").onclick = () => pipelineSource("paste");
      $("co-src-file").onclick = () => companionSource("file");
      $("co-src-paste").onclick = () => companionSource("paste");

      $("clear-form").onclick = clearPipe;
      $("run-pipe").onclick = runPipe;
      $("cancel-pipe").onclick = () => j("/api/pipeline/cancel", { method: "POST" }).catch(() => {});
      $("resume-btn").onclick = resume;
      $("dismiss-cp").onclick = () => j("/api/pipeline/checkpoint", { method: "DELETE" }).finally(() => $("resume").classList.remove("show"));
      $("tone").oninput = tone;

      $("article-title").oninput = () => {
        if (!$("article-slug").value.trim()) $("article-slug").value = slug($("article-title").value);
        validPipe();
      };
      $("article-url").oninput = validPipe;
      $("reflection-text").oninput = () => {
        validPipe();
        if (S.src === "paste") seedPipelineReflection($("reflection-text").value);
      };

      $("reflection-file").onchange = async e => {
        const file = e.target.files[0] || null;
        S.file = file;
        S.fileText = file ? await populateFromFile(file, {
          titleId: "article-title",
          slugId: "article-slug",
          urlId: "article-url",
          fileNameId: "file-name"
        }) : "";
        seedPipelineReflection(S.fileText);
        validPipe();
      };

      bindDropzone("drop", "reflection-file", async file => {
        S.file = file;
        S.fileText = await populateFromFile(file, {
          titleId: "article-title",
          slugId: "article-slug",
          urlId: "article-url",
          fileNameId: "file-name"
        });
        seedPipelineReflection(S.fileText);
        validPipe();
      });

      $("co-file").onchange = async e => {
        const file = e.target.files[0];
        if (file) await populateFromFile(file, {
          titleId: "co-title",
          slugId: "co-slug",
          urlId: "co-url",
          textId: "co-text",
          fileNameId: "co-file-name"
        });
      };
      bindDropzone("co-drop", "co-file", async file => {
        await populateFromFile(file, {
          titleId: "co-title",
          slugId: "co-slug",
          urlId: "co-url",
          textId: "co-text",
          fileNameId: "co-file-name"
        });
      });

      $("mk-file").onchange = async e => {
        const file = e.target.files[0];
        if (file) await populateFromFile(file, {
          titleId: "mk-gen-title",
          slugId: "mk-gen-slug",
          urlId: "mk-gen-url",
          textId: "mk-gen-text",
          fileNameId: "mk-file-name"
        });
      };
      bindDropzone("mk-drop", "mk-file", async file => {
        await populateFromFile(file, {
          titleId: "mk-gen-title",
          slugId: "mk-gen-slug",
          urlId: "mk-gen-url",
          textId: "mk-gen-text",
          fileNameId: "mk-file-name"
        });
      });

      $("th-file").onchange = async e => {
        const file = e.target.files[0];
        if (file) await populateFromFile(file, {
          titleId: "th-title",
          slugId: "th-slug",
          urlId: "th-url",
          textId: "th-text",
          fileNameId: "th-file-name"
        });
      };
      bindDropzone("th-drop", "th-file", async file => {
        await populateFromFile(file, {
          titleId: "th-title",
          slugId: "th-slug",
          urlId: "th-url",
          textId: "th-text",
          fileNameId: "th-file-name"
        });
      });

      $("co-run").onclick = runCo;
      $("mk-gen-run").onclick = runStandaloneMarketing;
      $("mk-fetch-url").onclick = fetchMkUrl;
      $("mk-open-library").onclick = () => setMarketingTab("library");
      $("mk-refresh").onclick = loadMk;
      $("mk-search").oninput = mkRender;
      $("sn-gen-btn").onclick = generateSnBatch;
      $("sn-search-q").oninput = e => {
        S.snSearch.q = e.target.value.trim();
        clearTimeout(S.snSearchTimer);
        S.snSearchTimer = setTimeout(snDoSearch, 350);
      };
      $("aud-br-search").oninput = e => {
        audBrState.q = e.target.value.trim();
        audBrState.offset = 0;
        clearTimeout(audBrState._timer);
        audBrState._timer = setTimeout(loadAudienceList, 350);
      };
      $("qt-refresh").onclick = loadQuotesRuns;
      $("sched-refresh").onclick = loadScheduledQueue;
      $("published-refresh").onclick = loadPublishedFeed;
      $("aud-refresh-btn").onclick = () => loadAudience();

      $("sub-refresh-preview").onclick = refreshSubstackPreview;
      $("sub-copy-md").onclick = async () => {
        const md = assembleSubstackMarkdown();
        await navigator.clipboard.writeText(md);
        const s = $("sub-copy-status"); s.textContent = "✓ Markdown copied";
        setTimeout(() => { s.textContent = ""; }, 2500);
      };
      $("sub-copy-html").onclick = async () => {
        const html = assembleSubstackHtml();
        await navigator.clipboard.writeText(html);
        const s = $("sub-copy-status"); s.textContent = "✓ HTML copied";
        setTimeout(() => { s.textContent = ""; }, 2500);
      };
      $("sub-test-conn").onclick = async () => {
        const btn = $("sub-test-conn"); btn.disabled = true; btn.textContent = "Testing…";
        const status = $("sub-conn-status");
        try {
          const data = await j("/api/substack/test", { method: "POST" });
          status.textContent = "✓ Connected as @" + (data.handle || "unknown");
          status.style.color = "var(--ok)";
        } catch (e) {
          status.textContent = "✗ " + (e.message || "Connection failed");
          status.style.color = "var(--danger)";
        } finally {
          btn.disabled = false; btn.textContent = "Test connection";
        }
      };
      $("hist-refresh").onclick = loadHist;
      $("idea-save").onclick = saveIdea;
      $("ideas-refresh").onclick = loadIdeas;
      $("reddit-run").onclick = runReddit;
      $("template-upload").onclick = upTemplate;
      $("sched-open-queue").onclick = () => {
        mode("marketing");
        setMarketingTab("scheduled");
        $("mk-pane-scheduled").scrollIntoView({ behavior: "smooth", block: "start" });
      };
      const signedIn = await loadAuthSession();
      if (signedIn) {
        mode(localStorage.getItem("ep_page") || "pipeline");
        loadCp();
        loadMk();
        loadHist();
        loadIdeas();
        loadDash();
        loadTemplate();
        loadArticles();
        loadCfg();
      } else {
        authError("Sign in with your local admin credentials to continue.");
      }
      $("articles-refresh").onclick = refreshArticles;
      $("articles-new").onclick = newArticles;
      $("cfg-save").onclick = saveCfg;
      ["cfg-voice", "cfg-comp", "cfg-es", "cfg-th"].forEach(id => $(id).oninput = renderConfigPreviews);
      $("th-auto").onclick = () => genConcepts(true);
      $("th-review").onclick = () => genConcepts(false);
      $("th-images").onclick = genImages;
      $("th-single").onclick = genSingle;
      $("th-refresh").onclick = loadThumbs;
      $("th-search").oninput = loadThumbs;
    });
