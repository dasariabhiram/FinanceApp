import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CustomerApp } from "./routes/CustomerApp";
import { AdminApp } from "./routes/AdminApp";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerApp />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
