import React from 'react';
import { Users, Hourglass as HourglassMedium } from 'lucide-react';

interface Player {
  nickname: string;
  score: number;
}

interface WaitingRoomProps {
  players: Player[]; // La prop se espera que sea un array de Player
}

//                                         vvvvvvvvvvvvvvv
const WaitingRoom: React.FC<WaitingRoomProps> = ({ players = [] }) => {
//                                         ^^^^^^^^^^^^^^^ 
// CAMBIO CLAVE: Se asigna un valor por defecto [] a la prop 'players'.
// Si 'players' llega como undefined desde el padre, aquí se tomará como un array vacío.

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full">
            <HourglassMedium size={40} className="text-blue-800" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Esperando el siguiente problema...
        </h2>
        <p className="text-gray-600">
          El administrador iniciará el siguiente problema pronto. ¡Prepárate!
        </p>
      </div>
      
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-4">
          <Users size={20} className="text-gray-600 mr-2" />
          {/* Ahora 'players.length' es seguro porque 'players' siempre será un array */}
          <h3 className="text-lg font-semibold text-gray-800">
            Jugadores en la Sala ({players.length})
          </h3>
        </div>
        
        <div className="space-y-2">
          {/* 'players.map' también es seguro ahora */}
          {players.map((player) => (
            <div 
              key={player.nickname}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
            >
              <div className="font-medium">{player.nickname}</div>
              <div className="text-gray-600">
                Puntaje: <span className="font-semibold">{(player.score || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          
          {/* 'players.length === 0' también es seguro */}
          {players.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              Aún no se han unido jugadores
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;