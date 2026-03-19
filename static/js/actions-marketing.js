// Extracted marketing action handlers from bootstrap.js

function handleNoteAction(action, kind) {
      if (kind === "sn-new-post") { snNewPost(); }
      else if (kind === "sn-filter") {
        const f = action.dataset.filter;
        if (f === "shared") S.snSearch.shared = !S.snSearch.shared;
        else if (f === "repurposed") S.snSearch.repurposed = !S.snSearch.repurposed;
        else if (f === "signal-pos") S.snSearch.signal = S.snSearch.signal === "positive" ? "" : "positive";
        else if (f === "signal-neg") S.snSearch.signal = S.snSearch.signal === "negative" ? "" : "negative";
        action.classList.toggle("active",
          f === "shared" ? S.snSearch.shared :
          f === "repurposed" ? S.snSearch.repurposed :
          f === "signal-pos" ? S.snSearch.signal === "positive" :
          S.snSearch.signal === "negative"
        );
        snDoSearch();
      } else if (kind === "sn-batch-toggle") {
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
      } else if (kind === "sn-batch-del") {
        const bid = action.dataset.bid;
        if (!confirm("Delete batch #" + bid + " and all its notes?")) return true;
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
      } else if (kind === "sn-batch-show-all") {
        const bid = action.dataset.bid;
        S.snBatchShowAll[bid] = true;
        const notesEl = $("sn-batch-notes-" + bid);
        if (notesEl) notesEl.innerHTML = _snBatchNotesListHtml(bid, S.snBatchNotesCache[bid] || []);
      } else if (kind === "sn-note-open") {
        const nid = action.dataset.nid;
        const bid = action.dataset.bid;
        const notes = S.snBatchNotesCache[bid] || [];
        const note = notes.find(n => String(n.id) === String(nid));
        if (note) snOpenNote(note);
      } else if (kind === "sn-shared") {
        const val = action.dataset.val === "1";
        const nid = action.dataset.id;
        j("/api/substack-notes/" + nid, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shared: val })
        }).then(() => {
          for (const bid in S.snBatchNotesCache) {
            const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(nid));
            if (n) { n.shared = val ? 1 : 0; break; }
          }
          if (S.snSelectedNote && String(S.snSelectedNote.id) === String(nid)) {
            S.snSelectedNote.shared = val ? 1 : 0;
            snNoteDetailRender();
          }
        });
      } else if (kind === "sn-signal") {
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
      } else if (kind === "sn-edit-open") {
        const id = action.dataset.id;
        const edit = $("sn-edit-" + id);
        const ta = $("sn-edit-ta-" + id);
        const preview = $("sn-edit-preview-" + id);
        if (!edit || !ta) return true;
        edit.classList.add("open");
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
      } else if (kind === "sn-edit-cancel") {
        const id = action.dataset.id;
        const edit = $("sn-edit-" + id);
        const ta = $("sn-edit-ta-" + id);
        if (!edit || !ta) return true;
        if (S.snSelectedNote && String(S.snSelectedNote.id) === String(id)) ta.value = S.snSelectedNote.note_text;
        edit.classList.remove("open");
        const detail = $("sn-note-detail");
        if (detail) {
          const platBar = detail.querySelector(".sn-plat-bar");
          if (platBar) platBar.style.display = "";
          detail.querySelectorAll(".sn-plat-panel").forEach(p => { p.style.display = ""; });
          const activePanel = detail.querySelector(".sn-plat-panel.active");
          if (activePanel) activePanel.style.display = "block";
        }
      } else if (kind === "sn-edit-save") {
        const id = action.dataset.id;
        const ta = $("sn-edit-ta-" + id);
        const edit = $("sn-edit-" + id);
        if (!ta) return true;
        const newText = ta.value.trim();
        if (!newText) return true;
        action.disabled = true; action.textContent = "Saving…";
        j("/api/substack-notes/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_text: newText })
        }).then(() => {
          for (const bid in S.snBatchNotesCache) {
            const n = S.snBatchNotesCache[bid].find(n => String(n.id) === String(id));
            if (n) { n.note_text = newText; break; }
          }
          if (S.snSelectedNote && String(S.snSelectedNote.id) === String(id)) {
            S.snSelectedNote.note_text = newText;
          }
          if (edit) edit.classList.remove("open");
          action.disabled = false; action.textContent = "Save";
          snNoteDetailRender();
        }).catch(e => {
          action.disabled = false; action.textContent = "Save";
          alert("Save failed: " + (e.message || "unknown error"));
        });
      } else if (kind === "sn-promote") {
        j("/api/substack-notes/" + action.dataset.id + "/promote", { method: "POST" })
          .then(() => { action.textContent = "✓ Added"; action.disabled = true; })
          .catch(e => alert("Promote failed: " + e.message));
      } else if (kind === "sn-repurpose") {
        const nid = action.dataset.id;
        action.disabled = true;
        action.textContent = "Generating…";
        j("/api/substack-notes/" + nid + "/repurpose", { method: "POST" })
          .then(data => {
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
      } else if (kind === "sn-plat-tab") {
        const nid = action.dataset.nid;
        const plat = action.dataset.plat;
        const detail = $("sn-note-detail");
        if (!detail) return true;
        detail.querySelectorAll(".sn-plat-btn").forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
        detail.querySelectorAll(".sn-plat-panel").forEach(p => {
          const active = p.id === "sn-det-panel-" + nid + "-" + plat;
          p.classList.toggle("active", active);
          p.style.display = active ? "block" : "none";
        });
      } else if (kind === "cmp-platform") { snComposeSelectPlatform(action.dataset.plat); }
      else if (kind === "cmp-repurpose") { snComposeRepurpose(action); }
      else if (kind === "cmp-start-over") { S.compose.repurpose = null; snComposeRender(); }
      else if (kind === "sn-note-save") {
        const nid = action.dataset.nid;
        const textId = action.dataset.textId;
        const ta = $(textId);
        if (!ta) return true;
        const newText = (ta.isContentEditable ? htmlToMarkdown(ta.innerHTML) : ta.value).trim();
        if (!newText) return true;
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
      } else if (kind === "sn-rep-thumb") {
        const issue = decodeURIComponent(action.dataset.issue || "");
        mode("thumbnail");
        pipelineSource && pipelineSource("paste");
        const titleEl = $("th-title");
        const textEl = $("th-text");
        if (titleEl) titleEl.value = issue;
        if (textEl) textEl.value = issue;
      } else if (kind === "sn-sa-open") {
        const panel = $(action.dataset.panel);
        if (panel) panel.classList.toggle("open");
      } else if (kind === "sn-sa-cancel") {
        const panel = $(action.dataset.panel);
        if (panel) panel.classList.remove("open");
      } else if (kind === "sn-sa-toggle") {
        action.classList.toggle("active");
      } else if (kind === "sn-sa-confirm") {
        const panel = $(action.dataset.panel);
        if (!panel) return true;
        const dtInput = panel.querySelector(".sn-sa-dt");
        const tzSel = panel.querySelector(".sn-sa-tz");
        const dt = dtInput ? dtInput.value : "";
        if (!dt) { alert("Pick a date and time first."); return true; }
        const tz = tzSel ? tzSel.value : "";
        const scheduledAt = tzToUtcIso(dt, tz);
        const tzName = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const noteId = panel.dataset.noteId ? parseInt(panel.dataset.noteId) : null;
        const pills = panel.querySelectorAll("[data-a='sn-sa-toggle']");
        const selected = Array.from(pills).filter(p => p.classList.contains("active"));
        if (!selected.length) { alert("Select at least one platform."); return true; }
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
      } else {
        return false;
      }
      return true;
    }

    function handleQuoteAction(action, kind) {
      if (kind === "qt-copy") {
        navigator.clipboard.writeText(action.dataset.text || "").catch(() => {});
        const orig = action.textContent; action.textContent = "Copied!"; setTimeout(() => action.textContent = orig, 1500);
      } else if (kind === "qt-run-select") {
        const run = S.quotesRuns.find(r => String(r.run_id) === String(action.dataset.runId));
        if (run) selectQuotesRun(run);
      } else if (kind === "qt-shared") {
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
      } else if (kind === "qt-signal-pos" || kind === "qt-signal-neg") {
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
      } else if (kind === "qt-repurpose") {
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
      } else if (kind === "qt-rep-tab") {
        const qid = action.dataset.qid;
        const plat = action.dataset.plat;
        document.querySelectorAll('[data-a="qt-rep-tab"][data-qid="' + qid + '"]').forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
        document.querySelectorAll('[id^="qt-rp-' + qid + '-"]').forEach(p => p.classList.toggle("active", p.id === "qt-rp-" + qid + "-" + plat));
      } else if (kind === "qt-rep-publish") {
        const text = action.dataset.text || "";
        const platform = action.dataset.plat;
        if (!text) return true;
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
      } else if (kind === "qt-promote") {
        j("/api/quotes/" + action.dataset.qid + "/promote", { method: "POST" })
          .then(() => { action.textContent = "✓ Added"; action.disabled = true; })
          .catch(e => alert("Promote failed: " + e.message));
      } else {
        return false;
      }
      return true;
    }

    function handlePublishingAction(action, kind) {
      if (kind === "mk-plat-tab") {
        const plat = action.dataset.plat;
        const preview = $("mk-library-preview");
        if (!preview) return true;
        preview.querySelectorAll(".sn-plat-btn").forEach(b => b.classList.toggle("active", b.dataset.plat === plat));
        preview.querySelectorAll(".sn-plat-panel").forEach(p => {
          const active = p.dataset.plat === plat;
          p.classList.toggle("active", active);
          p.style.display = active ? "block" : "none";
        });
      } else if (kind === "sched-open") {
        const picker = $(action.dataset.picker);
        if (!picker) return true;
        picker.classList.toggle("open");
        const dt = $(action.dataset.picker.replace("sched-pk-", "sched-dt-"));
        if (dt && !dt.value) {
          const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
          const pad = n => String(n).padStart(2, "0");
          dt.value = d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
        }
      } else if (kind === "sched-cancel") {
        const picker = $(action.dataset.picker);
        if (picker) picker.classList.remove("open");
      } else if (kind === "sched-confirm") {
        const dtInput = $("sched-dt-" + action.dataset.id);
        const text = getElPlainText($(action.dataset.id));
        const dt = dtInput ? dtInput.value : "";
        if (!dt || !text.trim()) return true;
        const tzSel = $("sched-tz-" + action.dataset.id);
        const tz = tzSel ? tzSel.value : "";
        const scheduledAt = tzToUtcIso(dt, tz);
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
            return true;
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
      } else if (kind === "sched-del") {
        j("/api/social/scheduled/" + action.dataset.id, { method: "DELETE" }).then(loadScheduledQueue);
      } else if (kind === "sched-hard-del") {
        j("/api/social/scheduled/" + action.dataset.id + "/hard", { method: "DELETE" }).then(loadScheduledQueue);
      } else if (kind === "sched-gen-image") {
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
      } else if (kind === "sched-signal") {
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
          const row = action.closest(".sched-item");
          row.querySelectorAll(".sched-signal-btn").forEach(b => b.classList.remove("active-pos", "active-neg"));
          if (newVal === "positive") action.classList.add("active-pos");
          else if (newVal === "negative") action.classList.add("active-neg");
        });
      } else {
        return false;
      }
      return true;
    }
