    function setAuthUi() {
      const user = S.auth.user;
      $("auth-overlay").classList.toggle("show", !user);
      $("auth-toolbar").classList.toggle("hide", !user);
      $("auth-mode-label").textContent = "Auth mode: " + (S.auth.authMode || "local");
      if (user) {
        $("auth-user-label").textContent = user.display_name || user.email;
        $("auth-user-role").textContent = user.role;
        $("users-card").classList.toggle("hide", user.role !== "superadmin");
      } else {
        $("auth-user-label").textContent = "Not signed in";
        $("auth-user-role").textContent = "guest";
        $("users-card").classList.add("hide");
      }
      applyRoleUi(document);
    }

    function authError(message) {
      const el = $("auth-status");
      el.textContent = message || "";
      el.classList.toggle("error", !!message);
    }

    function handleUnauthenticated() {
      S.auth.user = null;
      S.auth.users = [];
      setAuthUi();
      authError("Your session expired. Sign in again.");
    }

    function j(url, opts) {
      const cfg = { ...(opts || {}) };
      const skipAuthRedirect = !!cfg.skipAuthRedirect;
      delete cfg.skipAuthRedirect;
      return fetch(url, cfg).then(async r => {
        const text = await r.text();
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) {}
        if (!r.ok) {
          const message = parsed && parsed.detail ? parsed.detail : (text || ("Request failed (" + r.status + ")"));
          if (r.status === 401 && !skipAuthRedirect) handleUnauthenticated();
          throw new Error(message);
        }
        return parsed;
      });
    }

    async function sse(promise, handler) {
      const response = await promise;
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 401) handleUnauthenticated();
        throw new Error(text || ("Request failed (" + response.status + ")"));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();
        events.forEach(chunk => {
          if (!chunk.trim()) return;
          let type = "message";
          let data = "{}";
          chunk.split("\n").forEach(line => {
            if (line.startsWith("event: ")) type = line.slice(7).trim();
            if (line.startsWith("data: ")) data = line.slice(6).trim();
          });
          try {
            handler(type, JSON.parse(data));
          } catch (e) {
            handler("error", { message: "Failed to parse stream event." });
          }
        });
      }
    }

    async function loadAuthSession() {
      const data = await j("/api/auth/me", { skipAuthRedirect: true });
      S.auth.authMode = data.auth_mode || "local";
      S.auth.user = data.authenticated ? data.user : null;
      S.auth.ready = true;
      setAuthUi();
      return !!S.auth.user;
    }

    async function login() {
      authError("");
      try {
        const data = await j("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: $("login-email").value.trim(),
            password: $("login-password").value
          }),
          skipAuthRedirect: true
        });
        S.auth.authMode = data.auth_mode || "local";
        S.auth.user = data.user || null;
        $("login-password").value = "";
        setAuthUi();
        authError("");
        mode(localStorage.getItem("ep_page") || "pipeline");
      } catch (e) {
        authError(e.message);
      }
    }

    async function logout() {
      try { await j("/api/auth/logout", { method: "POST", skipAuthRedirect: true }); } catch (e) {}
      handleUnauthenticated();
    }

    function usersHtml(users) {
      if (!users.length) return '<div class="empty">No internal users created yet.</div>';
      return users.map(user =>
        '<div class="user-row">' +
          '<div>' +
            '<strong>' + H(user.display_name || user.email) + '</strong>' +
            '<div class="user-row-meta">' + H(user.email) + ' · last login ' + H(user.last_login_at ? timeAgo(user.last_login_at) : 'never') + '</div>' +
          '</div>' +
          '<span class="auth-role">' + H(user.role || "operator") + '</span>' +
          '<span class="tag">' + H(user.status || "active") + '</span>' +
        '</div>'
      ).join("");
    }

    async function loadUsers() {
      if (!S.auth.user || S.auth.user.role !== "superadmin") {
        $("users-list").innerHTML = '<div class="empty">Sign in as superadmin to manage users.</div>';
        return;
      }
      try {
        const data = await j("/api/auth/users");
        S.auth.users = data.users || [];
        $("users-list").innerHTML = usersHtml(S.auth.users);
        $("users-status").textContent = "Manage internal operators from here.";
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }

    async function createUser() {
      try {
        await j("/api/auth/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: $("new-user-email").value.trim(),
            display_name: $("new-user-name").value.trim(),
            role: $("new-user-role").value,
            password: $("new-user-password").value
          })
        });
        $("new-user-email").value = "";
        $("new-user-name").value = "";
        $("new-user-password").value = "";
        $("new-user-role").value = "operator";
        $("users-status").textContent = "Account created.";
        loadUsers();
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }
