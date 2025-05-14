import React from 'react';
import { Users } from 'lucide-react';

interface Player {
  nickname: string;
  score: number;
}

interface PlayerListProps {
  players: Player[];
}

const PlayerList: React.FC<PlayerListProps> = ({ players }) => {
  // Ordenar jugadores por puntaje (el más alto primero)
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  return (
    <div>
      {sortedPlayers.length > 0 ? (
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.nickname}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
            >
              <div className="flex items-center">
                <span className="font-medium text-gray-600 mr-2">
                  {index + 1}.
                </span>
                <span className="font-medium">{player.nickname}</span>
              </div>
              {/* Mostrar puntaje con 2 decimales y valor por defecto 0 */}
              <div className="font-bold">{(player.score || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <Users size={30} className="text-gray-400 mb-2" />
          <p className="text-gray-500">
            Aún no se han unido jugadores. Comparte la URL de la sesión para invitar.
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerList;