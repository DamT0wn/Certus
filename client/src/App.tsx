import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { DocumentPage } from "./pages/DocumentPage";
import { BriefPage } from "./pages/BriefPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/document/:id" element={<DocumentPage />} />
        <Route path="/document/:id/brief" element={<BriefPage />} />
      </Routes>
    </BrowserRouter>
  );
}
