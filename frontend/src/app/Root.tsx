import { Outlet, useLocation, useNavigate } from "react-router";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { PipelineQueueWidget } from "./components/PipelineQueueWidget";
import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { PipelineProvider } from "../lib/pipeline-context";
import { LoginOverlay } from "../components/LoginOverlay";

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on every route change (mobile-first design language)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const getActiveSection = () => {
    const path = location.pathname.slice(1).split("/")[0];
    return path || "pipeline";
  };

  const activeSection = getActiveSection();

  if (loading) return null;
  if (!user) return <LoginOverlay />;

  return (
    <div className="size-full flex bg-background" style={{ height: "100dvh", overflow: "hidden" }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(s) => { navigate(s === "pipeline" ? "/" : `/${s}`); }}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 right-0 z-50 lg:hidden">
            <Sidebar
              activeSection={activeSection}
              onSectionChange={(s) => { navigate(s === "pipeline" ? "/" : `/${s}`); setMobileMenuOpen(false); }}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5 lg:p-5">
          <Outlet />
        </main>
      </div>

      <PipelineQueueWidget />
    </div>
  );
}

export default function Root() {
  return (
    <AuthProvider>
      <PipelineProvider>
        <AppShell />
      </PipelineProvider>
    </AuthProvider>
  );
}
