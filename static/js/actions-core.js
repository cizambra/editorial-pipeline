// Extracted domain action handlers from bootstrap.js

function handleCoreAction(action, kind) {
      if (kind === "dl") dl(decodeURIComponent(action.dataset.text || ""), decodeURIComponent(action.dataset.file || "document.md"));
      else if (kind === "copy") copy(action.dataset.id, action);
      else if (kind === "copy-doc") copyText(decodeURIComponent(action.dataset.text || ""), action);
      else if (kind === "doc-view") setDocView(action.dataset.id, action.dataset.view);
      else if (kind === "mk-select") selectMarketingRun(action.dataset.id);
      else if (kind === "repurpose") repurposeFromExisting(action.dataset.id, action.dataset.source, action.dataset.lang, action.dataset.platform);
      else if (kind === "social-publish") publishSocial(action.dataset.platform, action.dataset.id, action);
      else if (kind === "regen") regen(action.dataset.source, action.dataset.lang, action.dataset.platform);
      else if (kind === "open-run") openRun(action.dataset.id, action.dataset.mode);
      else if (kind === "open-thumb") openThumb(action.dataset.id);
      else if (kind === "del-run") j("/api/history/" + action.dataset.id, { method: "DELETE" }).then(() => { loadHist(); loadMk(); loadDash(); });
      else if (kind === "goto-marketing") { mode("marketing"); setMarketingTab("library"); }
      else if (kind === "queue-pipeline") {
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
      } else {
        return false;
      }
      return true;
    }

    function handleIdeaAction(action, kind) {
      if (kind === "idea-status") j("/api/ideas/" + action.dataset.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.dataset.status })
      }).then(loadIdeas);
      else if (kind === "idea-del") j("/api/ideas/" + action.dataset.id, { method: "DELETE" }).then(loadIdeas);
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
      } else {
        return false;
      }
      return true;
    }

    function handleThumbnailAction(action, kind) {
      if (kind === "pick-concept") {
        S.thumbConceptSelected = action.dataset.index;
        thRender();
      } else if (kind === "save-thumb") saveThumb(action.dataset.index);
      else if (kind === "dl-thumb") {
        let b64 = null;
        if (action.dataset.draftIndex !== undefined) {
          const concept = (S.thumbDraft.concepts || []).find(v => Number(v.index) === Number(action.dataset.draftIndex));
          b64 = concept ? concept.image_b64 : null;
        } else {
          b64 = S.thumbSelected ? S.thumbSelected.image_b64 : null;
        }
        if (!b64) return true;
        const a = document.createElement("a");
        a.href = "data:image/png;base64," + b64;
        a.download = (action.dataset.name || "thumbnail") + ".png";
        a.click();
      } else if (kind === "del-thumb") j("/api/thumbnails/" + action.dataset.id, { method: "DELETE" }).then(() => {
        if (S.thumbSelected && String(S.thumbSelected.id) === String(action.dataset.id)) {
          S.thumbSelected = null;
          renderThumbDetail();
        }
        loadThumbs();
      });
      else return false;
      return true;
    }

    function handleAudienceAction(action, kind) {
      if (kind === "aud-sync") syncSubscribers();
      else if (kind === "aud-tab") {
        const tab = action.dataset.tab;
        document.querySelectorAll('[data-a="aud-tab"]').forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        $("aud-pane-browser").style.display  = tab === "browser"  ? "" : "none";
        $("aud-pane-insights").style.display = tab === "insights" ? "" : "none";
      } else if (kind === "aud-insights-load") loadInsights();
      else if (kind === "ins-rec-tab") {
        _insRecTab = action.dataset.tab;
        document.querySelectorAll('[data-a="ins-rec-tab"]').forEach(b => b.classList.toggle("active", b.dataset.tab === _insRecTab));
        const body = $("aud-insights-body");
        if (!body || !body.dataset.recs) return true;
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
      } else if (kind === "aud-sub-open") openSubscriberDetail(action.dataset.email);
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
      } else if (kind === "aud-page") {
        const dir = parseInt(action.dataset.dir) || 1;
        audBrState.offset = Math.max(0, audBrState.offset + dir * audBrState.limit);
        loadAudienceList();
      } else {
        return false;
      }
      return true;
    }
