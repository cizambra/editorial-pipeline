// Extracted from static/js/app.js during runtime refactor.

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

    bindUiGroup("document", handleGlobalUiClick);
    bindUiGroup(["page-marketing"], handleMarketingUiClick);

    bindInputGroup(["page-marketing"], handleSocialTextInput);

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

      $("new-run").onclick = startNewRun;
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
