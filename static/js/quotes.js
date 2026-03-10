// Extracted from static/js/app.js during runtime refactor.

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
