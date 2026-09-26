import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const UploadPage = lazy(() => import("./pages/UploadPage").then((module) => ({ default: module.UploadPage })));
const DocumentPage = lazy(() => import("./pages/DocumentPage").then((module) => ({ default: module.DocumentPage })));
const BriefPage = lazy(() => import("./pages/BriefPage").then((module) => ({ default: module.BriefPage })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<main className="min-h-screen grid place-items-center bg-[#FAF9F6] text-[#14171F]"><p role="status">Loading Certus…</p></main>}>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/document/:id" element={<DocumentPage />} />
          <Route path="/document/:id/brief" element={<BriefPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
