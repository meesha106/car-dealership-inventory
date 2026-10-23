import { Route, Routes } from "react-router-dom";

function StatusPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center text-slate-900">
      <div>
        <h1 className="text-3xl font-bold">Car Dealership Inventory System</h1>
        <p className="mt-3 text-lg">The app is running.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
      <Route path="/login" element={<StatusPage />} />
      <Route path="/register" element={<StatusPage />} />
      <Route path="/dashboard" element={<StatusPage />} />
      <Route path="*" element={<StatusPage />} />
    </Routes>
  );
}
