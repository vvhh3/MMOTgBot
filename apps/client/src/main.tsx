import { MotionConfig } from "motion/react";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Theme } from "@radix-ui/themes";

import "@radix-ui/themes/styles.css";
import App from "./app/App";
import "./app/styles.css";

const ComponentShowcase = import.meta.env.VITE_ADMIN_PANEL === "true"
  ? lazy(() => import("./features/ui-showcase/ComponentShowcase"))
  : null;

function ShowcaseRoute() {
  const { search } = useLocation();
  if (!ComponentShowcase) return <Navigate to={{ pathname: "/", search }} replace />;

  return <Theme>
    <Suspense fallback={<p className="p-6">Загружаем витрину компонентов…</p>}>
      <ComponentShowcase />
    </Suspense>
  </Theme>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/ui" element={<ShowcaseRoute />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>
);
