import React from 'react';
import { Trophy, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Player {
  nickname: string;
  score: number;
}

// Asegúrate que esta interfaz esté exactamente así en tu archivo
interface PlayerResult {
  playerId: string;
  nickname: string;
  answer: string;
  isCorrect: boolean;
  pointsAwarded: number; 
  timeTaken: number | null; 
}

interface ResultsViewProps {
  solution: string;
  leaderboard: Player[];
  playerResults: PlayerResult[];
  currentPlayerNickname: string;
}

const ResultsView: React.FC<ResultsViewProps> = ({
  solution,
  leaderboard,
  playerResults,
  currentPlayerNickname
}) => {
  const currentPlayerResult = playerResults.find(
    (result) => result.nickname === currentPlayerNickname
  );
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Solución del Problema
          </h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Solución Correcta
            </h3>
            <div className="font-mono text-lg">
              {solution || "(No se proporcionó solución)"}
            </div>
          </div>
          
          {currentPlayerResult && (
            <div className={`rounded-md p-4 mb-6 ${
              currentPlayerResult.isCorrect 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <h3 className="text-lg font-semibold flex items-center mb-2">
                {currentPlayerResult.isCorrect ? (
                  <>
                    <CheckCircle size={20} className="text-green-600 mr-2" />
                    <span className="text-green-800">¡Tu respuesta fue correcta!</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} className="text-red-600 mr-2" />
                    <span className="text-red-800">Tu respuesta fue incorrecta</span>
                  </>
                )}
              </h3>
              
              <div>
                <span className="font-medium text-gray-700">Tu respuesta: </span>
                <span className="font-mono">
                  {currentPlayerResult.answer || '(Sin respuesta)'}
                </span>
              </div>
              {currentPlayerResult.timeTaken !== null && (
                <div className="text-sm text-gray-600 mt-1 flex items-center">
                  <Clock size={14} className="mr-1 text-gray-500"/>
                  Tiempo: <span className="font-medium ml-1">{currentPlayerResult.timeTaken}s</span>
                </div>
              )}
              <div className="text-sm text-gray-600 mt-1">
                Puntos esta ronda: <span className="font-medium">{(currentPlayerResult.pointsAwarded || 0).toFixed(2)}</span> {/* <--- AÑADIDO || 0 */}
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Resultados de Todos los Jugadores
            </h3>
            
            <div className="space-y-2">
              {playerResults.map((result) => (
                <div 
                  key={result.playerId}
                  className={`p-3 rounded-md border ${
                    result.nickname === currentPlayerNickname
                      ? 'bg-blue-50 border-blue-200'
                      : result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center mb-1">
                    <div className="mr-2">
                      {result.isCorrect ? (
                        <CheckCircle size={18} className="text-green-600" />
                      ) : (
                        <XCircle size={18} className="text-red-600" />
                      )}
                    </div>
                    <div className="font-medium text-gray-800">
                      {result.nickname}
                      {result.nickname === currentPlayerNickname && (
                        <span className="ml-2 text-blue-700 text-xs font-normal">(Tú)</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 pl-7">
                    Respuesta: <span className="font-mono">{result.answer || '(Sin respuesta)'}</span>
                  </div>
                  {result.timeTaken !== null && (
                    <div className="text-xs text-gray-500 mt-0.5 pl-7 flex items-center">
                      <Clock size={12} className="mr-1"/>
                      Tiempo: {result.timeTaken}s
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5 pl-7">
                    Puntos en ronda: {(result.pointsAwarded || 0).toFixed(2)} {/* <--- AÑADIDO || 0 */}
                  </div>
                </div>
              ))}
               {playerResults.length === 0 && (
                 <p className="text-gray-500 text-sm">Nadie envió una respuesta para este problema.</p>
               )}
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">
              Tabla de Clasificación
            </h3>
            <Trophy size={24} className="text-yellow-500" />
          </div>
          
          <div className="space-y-2">
            {leaderboard.sort((a,b) => b.score - a.score).map((player, index) => (
              <div 
                key={player.nickname}
                className={`flex items-center p-3 rounded-md ${
                  player.nickname === currentPlayerNickname
                    ? 'bg-blue-100 border border-blue-300'
                    : index === 0 
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className={`text-lg font-bold mr-3 w-8 text-center ${
                    index === 0 ? 'text-yellow-600' : 
                    index === 1 ? 'text-gray-500' :
                    index === 2 ? 'text-orange-700' : 'text-gray-700'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {player.nickname}
                    {player.nickname === currentPlayerNickname && (
                      <span className="ml-2 text-blue-700 text-xs font-normal">(Tú)</span>
                    )}
                  </div>
                </div>
                <div className="font-bold text-lg text-gray-800">
                  {(player.score || 0).toFixed(2)} {/* <--- AÑADIDO || 0 */}
                </div>
              </div>
            ))}
            
            {leaderboard.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                Aún no hay puntajes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;