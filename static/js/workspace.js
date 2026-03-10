// Extracted from static/js/app.js during runtime refactor.

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
