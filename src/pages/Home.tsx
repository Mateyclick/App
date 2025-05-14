import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RssIcon as ChessIcon, Users } from 'lucide-react'; // El icono ChessIcon (originalmente RssIcon) se mantiene, puedes cambiarlo si deseas.

const Home: React.FC = () => {
  const [sessionId, setSessionId] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateSession = () => {
    navigate('/admin');
  };

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.trim()) {
      setError('Por favor, ingresa un ID de sesión');
      return;
    }
    if (!nickname.trim()) {
      setError('Por favor, ingresa un apodo');
      return;
    }
    
    sessionStorage.setItem('playerNickname', nickname);
    navigate(`/game/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex justify-center mb-6">
            <ChessIcon size={60} className="text-blue-800" />
          </div>
          
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Juego de Tácticas Trebejos 
          </h1>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Unirse a una Sesión de Juego</h2>
              <form onSubmit={handleJoinSession} className="space-y-4">
                <div>
                  <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700 mb-1">
                    ID de Sesión
                  </label>
                  <input
                    type="text"
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => { setSessionId(e.target.value); setError(''); }}
                    placeholder="Ingresa ID de sesión"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                    Apodo
                  </label>
                  <input
                    type="text"
                    id="nickname"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError(''); }}
                    placeholder="Ingresa tu apodo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
                >
                  <div className="flex items-center justify-center">
                    <Users size={18} className="mr-2" />
                    Unirse a Sesión
                  </div>
                </button>
              </form>
            </div>
            
            <div className="text-center">
              <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="flex-shrink mx-4 text-sm text-gray-500">o</span>
                  <div className="flex-grow border-t border-gray-300"></div>
              </div>
            </div>
            
            <button
              onClick={handleCreateSession}
              className="w-full bg-blue-800 hover:bg-blue-900 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Crear Nueva Sesión (Admin)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;