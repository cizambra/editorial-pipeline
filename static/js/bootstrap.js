// Extracted from static/js/app.js during runtime refactor.

    bindUiGroup("document", handleGlobalUiClick);
    bindUiGroup(["page-marketing"], handleMarketingUiClick);

    bindInputGroup(["page-marketing"], handleSocialTextInput);

    document.addEventListener("DOMContentLoaded", async () => {
      setTheme(S.theme);
      init();
      new MutationObserver(() => scheduleRoleUiRefresh()).observe(document.body, { childList: true, subtree: true });
      scheduleRoleUiRefresh();

      $("theme-btn").onclick = () => setTheme(S.theme === "dark" ? "light" : "dark");

      // Mobile — full-screen sidebar drawer (opened via "More" bottom nav button)
      const _drawerOverlay = $("mobile-drawer-overlay");
      const _sidebarClose = $("sidebar-close");
      const _sidebar = document.querySelector(".sidebar");
      function openDrawer() {
        if (_sidebar) _sidebar.classList.add("open");
        if (_drawerOverlay) _drawerOverlay.classList.add("show");
        document.body.style.overflow = "hidden";
      }
      function closeDrawer() {
        if (_sidebar) _sidebar.classList.remove("open");
        if (_drawerOverlay) _drawerOverlay.classList.remove("show");
        document.body.style.overflow = "";
      }
      const _moreBtn = $("more-btn");
      if (_moreBtn) _moreBtn.onclick = () =>
        _sidebar && _sidebar.classList.contains("open") ? closeDrawer() : openDrawer();
      if (_drawerOverlay) _drawerOverlay.onclick = closeDrawer;
      if (_sidebarClose) _sidebarClose.onclick = closeDrawer;
      $("login-btn").onclick = login;
      $("logout-btn").onclick = logout;
      $("create-user-btn").onclick = createUser;
      $("create-invite-btn").onclick = createInvite;
      $("audit-refresh-btn").onclick = loadAuditEvents;
      initAccessControlUi();
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
