// Extracted from static/js/app.js during runtime refactor.

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
