(function () {
  const authMode = document.body.dataset.authMode || "local";
  const statusEl = document.getElementById("invite-status");
  const tokenInput = document.getElementById("invite-token");
  const passwordWrap = document.getElementById("invite-password-wrap");
  const accessTokenWrap = document.getElementById("invite-access-token-wrap");

  function setStatus(message, isError) {
    statusEl.textContent = message || "";
    statusEl.classList.toggle("error", !!isError);
  }

  function configureFields() {
    if (authMode === "supabase") {
      passwordWrap.classList.add("hide");
      accessTokenWrap.classList.remove("hide");
      setStatus("Paste the access token from your authenticated Supabase session to accept the invite.", false);
    } else {
      passwordWrap.classList.remove("hide");
      accessTokenWrap.classList.add("hide");
    }
  }

  async function acceptInvite() {
    setStatus("Accepting invite...", false);
    const payload = {
      token: tokenInput.value.trim(),
      display_name: document.getElementById("invite-display-name").value.trim()
    };
    if (authMode === "supabase") {
      payload.access_token = document.getElementById("invite-access-token").value.trim();
    } else {
      payload.password = document.getElementById("invite-password").value;
    }
    try {
      const response = await fetch("/api/auth/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) {}
      if (!response.ok) {
        throw new Error((data && data.detail) || text || ("Request failed (" + response.status + ")"));
      }
      setStatus("Invite accepted. Redirecting to the workspace...", false);
      window.location.href = "/";
    } catch (error) {
      setStatus(error.message || "Could not accept invite.", true);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    configureFields();
    document.getElementById("invite-accept-btn").onclick = acceptInvite;
  });
}());
