// Extracted from static/js/app.js during runtime refactor.

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
