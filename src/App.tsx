import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import PlayerRoom from './pages/PlayerRoom';

function App() {
  return (
    // Contenedor principal con flexbox para empujar el footer hacia abajo
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* El contenido principal que crece para ocupar el espacio */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/game/:sessionId" element={<PlayerRoom />} />
          <Route path="*" element={<Navigate to="/" />} /> {/* Ruta comodín para redirigir */}
        </Routes>
      </main>
      
      {/* --- INICIO: Pie de Página con Créditos --- */}
      <footer className="w-full text-center p-4 mt-auto bg-gray-100 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          Diseñado y creado por{' '}
          <a 
            href="https://mateyclick.online" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            mateyclick
          </a>
          {' © '} 
          {new Date().getFullYear()} {/* Añade el año actual dinámicamente */}
        </p>
      </footer>
      {/* --- FIN: Pie de Página con Créditos --- */}
    </div>
  );
}

export default App;