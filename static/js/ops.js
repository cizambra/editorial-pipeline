// Extracted from static/js/app.js during runtime refactor.

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
        const status = String(run.status || "done").toLowerCase();
        const statusHtml = status === "running"
          ? '<span class="tag" style="font-size:10px;padding:2px 7px;background:color-mix(in srgb, var(--accent) 16%, white);color:var(--accent)">Running</span>'
          : status === "error"
            ? '<span class="tag" style="font-size:10px;padding:2px 7px;background:color-mix(in srgb, #b42318 14%, white);color:#b42318">Error</span>'
            : "";
        return '<div class="entry-item"><div class="between"><div><div style="font-weight:700;font-size:13px">' + H(run.title || "Untitled") + '</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;align-items:center"><span class="muted" style="font-size:11px">' + timeAgo(run.timestamp) + '</span>' + statusHtml + tagsHtml + '</div></div><div style="display:flex;gap:8px;align-items:center"><span class="tag">$' + H((run.cost_usd || 0).toFixed(4)) + '</span><button class="ghost" data-a="open-run" data-id="' + run.id + '" data-mode="pipeline">Open</button></div></div></div>';
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

      const dailySpend = Object.entries(data.daily_spend || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-10).reverse();
      const dailyMax = Math.max(1, ...dailySpend.map(([, value]) => Number(value.total_cost_usd || 0)));
      $("dash-cost-days").innerHTML = dailySpend.length
        ? '<div class="list">' + dailySpend.map(([day, value]) => {
          const runCost = Number(value.run_cost_usd || 0);
          const imageCost = Number(value.image_cost_usd || 0);
          const totalCost = Number(value.total_cost_usd || 0);
          const pct = Math.round((totalCost / dailyMax) * 100);
          return '<div class="entry" style="display:flex;align-items:center;gap:12px">' +
            '<div style="min-width:104px;font-weight:700;font-size:13px">' + H(day) + '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="meter"><span style="width:' + H(pct) + '%"></span></div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--muted)">' +
                '<span>Runs $' + H(runCost.toFixed(2)) + '</span>' +
                '<span>Images $' + H(imageCost.toFixed(2)) + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="min-width:72px;text-align:right;font-weight:800;font-size:13px">$' + H(totalCost.toFixed(2)) + '</div>' +
          '</div>';
        }).join("") + '</div>'
        : '<div class="empty">No spend recorded yet.</div>';
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
