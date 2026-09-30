import "./App.css";

function App() {
  return (
    <main
      className="min-h-screen bg-slate-900
      flex items-center justify-center"
    >
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white">Hello, Tailwind!</h1>

        <p className="mt-4 text-slate-300">Vite + React + TypeScript</p>

        <button
          className="mt-6 rounded-lg bg-blue-600
          px-6 py-3 text-white hover:bg-blue-700"
        >
          Get Started
        </button>
      </div>
    </main>
  );
}

export default App;
