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
      S.auth.invites = [];
      S.auth.audit = [];
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

    function invitesHtml(invites) {
      if (!invites.length) return '<div class="empty">No pending invites.</div>';
      return invites.map(invite =>
        '<div class="invite-row">' +
          '<div>' +
            '<strong>' + H(invite.display_name || invite.email) + '</strong>' +
            '<div class="user-row-meta">' + H(invite.email) + ' · expires ' + H(dt(invite.expires_at)) + '</div>' +
          '</div>' +
          '<span class="auth-role">' + H(invite.role || "operator") + '</span>' +
          '<div class="invite-actions">' +
            '<button class="btn btn-mini" data-invite-action="resend" data-invite-id="' + H(invite.id) + '">Resend</button>' +
            '<button class="btn btn-mini" data-invite-action="revoke" data-invite-id="' + H(invite.id) + '">Revoke</button>' +
          '</div>' +
        '</div>'
      ).join("");
    }

    function auditHtml(events) {
      if (!events.length) return '<div class="empty">No audit events yet.</div>';
      return events.map(event =>
        '<div class="audit-row">' +
          '<div class="audit-kicker">' + H(event.action || "event") + '</div>' +
          '<div class="audit-head">' +
            '<strong>' + H(event.actor_email || "system") + '</strong>' +
            '<span class="tag">' + H(event.actor_role || "system") + '</span>' +
            '<span class="audit-time">' + H(timeAgo(event.timestamp)) + '</span>' +
          '</div>' +
          '<div class="audit-meta">' + H(event.target_type || "target") + (event.target_id ? " · " + H(event.target_id) : "") + '</div>' +
        '</div>'
      ).join("");
    }

    function filteredAuditEvents() {
      const prefix = S.auth.auditFilter || "all";
      if (prefix === "all") return S.auth.audit;
      return (S.auth.audit || []).filter(event => String(event.action || "").startsWith(prefix + "."));
    }

    function renderAuditEvents() {
      $("audit-list").innerHTML = auditHtml(filteredAuditEvents());
      document.querySelectorAll("[data-audit-filter]").forEach(button => {
        button.classList.toggle("active", button.dataset.auditFilter === (S.auth.auditFilter || "all"));
      });
      const labels = {
        all: "Latest auth, queue, and config mutations.",
        auth: "Authentication and access-management activity.",
        queue: "Publishing queue mutations.",
        config: "Config and template changes."
      };
      $("audit-status").textContent = labels[S.auth.auditFilter || "all"] || labels.all;
    }

    async function loadUsers() {
      if (!S.auth.user || S.auth.user.role !== "superadmin") {
        $("users-list").innerHTML = '<div class="empty">Sign in as superadmin to manage users.</div>';
        $("invites-list").innerHTML = '<div class="empty">Sign in as superadmin to manage invites.</div>';
        $("audit-list").innerHTML = '<div class="empty">Sign in as superadmin to review audit history.</div>';
        return;
      }
      try {
        const data = await j("/api/auth/users");
        S.auth.users = data.users || [];
        S.auth.invites = data.invites || [];
        $("users-list").innerHTML = usersHtml(S.auth.users);
        $("invites-list").innerHTML = invitesHtml(S.auth.invites);
        $("users-status").textContent = "Manage internal operators, pending invites, and access changes from here.";
        await loadAuditEvents();
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }

    async function loadAuditEvents() {
      if (!S.auth.user || S.auth.user.role !== "superadmin") {
        $("audit-list").innerHTML = '<div class="empty">Sign in as superadmin to review audit history.</div>';
        return;
      }
      try {
        const data = await j("/api/audit?limit=40");
        S.auth.audit = data.events || [];
        renderAuditEvents();
      } catch (e) {
        $("audit-status").textContent = e.message;
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

    async function createInvite() {
      try {
        const data = await j("/api/auth/invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: $("invite-user-email").value.trim(),
            display_name: $("invite-user-name").value.trim(),
            role: $("invite-user-role").value
          })
        });
        $("invite-user-email").value = "";
        $("invite-user-name").value = "";
        $("invite-user-role").value = "operator";
        $("users-status").textContent = "Invite created. Share the accept link directly.";
        if (data.accept_path) await navigator.clipboard.writeText(location.origin + data.accept_path);
        loadUsers();
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }

    async function resendInvite(inviteId) {
      try {
        const data = await j("/api/auth/invites/" + inviteId + "/resend", { method: "POST" });
        $("users-status").textContent = "Invite refreshed.";
        if (data.accept_path) await navigator.clipboard.writeText(location.origin + data.accept_path);
        loadUsers();
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }

    async function revokeInvite(inviteId) {
      try {
        await j("/api/auth/invites/" + inviteId, { method: "DELETE" });
        $("users-status").textContent = "Invite revoked.";
        loadUsers();
      } catch (e) {
        $("users-status").textContent = e.message;
      }
    }

    function initAccessControlUi() {
      const invites = $("invites-list");
      if (invites && !invites.dataset.bound) {
        invites.dataset.bound = "true";
        invites.addEventListener("click", e => {
          const button = e.target.closest("[data-invite-action]");
          if (!button) return;
          const action = button.dataset.inviteAction;
          if (action === "resend") resendInvite(button.dataset.inviteId);
          else if (action === "revoke") revokeInvite(button.dataset.inviteId);
        });
      }
      const auditFilters = document.querySelector(".audit-filters");
      if (auditFilters && !auditFilters.dataset.bound) {
        auditFilters.dataset.bound = "true";
        auditFilters.addEventListener("click", e => {
          const button = e.target.closest("[data-audit-filter]");
          if (!button) return;
          S.auth.auditFilter = button.dataset.auditFilter || "all";
          renderAuditEvents();
        });
      }
    }
