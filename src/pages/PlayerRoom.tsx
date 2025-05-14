import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import WaitingRoom from '../components/player/WaitingRoom';
import PuzzleView from '../components/player/PuzzleView'; // Asegúrate que esta es la NUEVA versión de PuzzleView
import ResultsView from '../components/player/ResultsView';
import { RssIcon as ChessIcon } from 'lucide-react';

interface Player {
  id?: string; // Es bueno que el Player tenga un ID si el servidor lo envía en el leaderboard
  nickname: string;
  score: number;
}

interface PlayerResult {
  playerId: string;
  nickname: string;
  answer: string;
  isCorrect: boolean;
  pointsAwarded: number;
  timeTaken: number | null;
}

interface PuzzleData {
  position: string;
  timer: number;
  points: number;
}

const PlayerRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [uiError, setUiError] = useState('');
  const [attemptedAutoJoin, setAttemptedAutoJoin] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]); // Este estado es el que usa WaitingRoom
  const [initialPuzzleData, setInitialPuzzleData] = useState<PuzzleData | null>(null);
  const [currentFEN, setCurrentFEN] = useState<string | null>(null);
  const [puzzleActive, setPuzzleActive] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);

  const [sequenceCompleted, setSequenceCompleted] = useState(false);
  const [sequenceFailed, setSequenceFailed] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    solution: string;
    leaderboard: Player[]; // El servidor envía el leaderboard con esta estructura
    playerResults: PlayerResult[];
  } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [opponentLastMove, setOpponentLastMove] = useState<string | null>(null);

  useEffect(() => {
    const storedNickname = sessionStorage.getItem('playerNickname');
    if (storedNickname && storedNickname.trim() !== '') {
      setNickname(storedNickname);
      console.log(`PlayerRoom: Nickname cargado desde sessionStorage: "${storedNickname}"`);
    }
    setAttemptedAutoJoin(true);
  }, []);

  useEffect(() => {
    if (socket && isConnected && sessionId && nickname.trim() !== '' && !isJoined && attemptedAutoJoin) {
      console.log(`PlayerRoom: Intentando auto-join con nickname: "${nickname}", sessionId: "${sessionId}"`);
      socket.emit('join_session', { sessionId, nickname: nickname.trim() });
    }
  }, [socket, isConnected, sessionId, nickname, isJoined, attemptedAutoJoin]);

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setUiError('Por favor, ingresa un apodo');
      return;
    }
    sessionStorage.setItem('playerNickname', trimmedNickname);
    if (socket && isConnected && sessionId) {
      console.log(`PlayerRoom: Uniéndose con formulario. Nickname: "${trimmedNickname}", SessionID: "${sessionId}"`);
      socket.emit('join_session', { sessionId, nickname: trimmedNickname });
    }
  };

  const handlePlayerMoveAttempt = (moveSAN: string) => {
    if (!socket || !sessionId || sequenceCompleted || sequenceFailed || !puzzleActive) {
      console.log('PlayerRoom: handlePlayerMoveAttempt bloqueado. Condiciones:', {
        socketExists: !!socket,
        sessionIdExists: !!sessionId,
        sequenceCompleted,
        sequenceFailed,
        puzzleActive,
      });
      return;
    }
    console.log('PlayerRoom: Jugada recibida de PuzzleView (vía handlePlayerMoveAttempt):', moveSAN);
    socket.emit('submit_answer', { sessionId, answer: moveSAN });
    setFeedbackMessage('Procesando tu jugada...');
  };


  useEffect(() => {
    if (!socket) return;

    const handleSessionJoined = (data: Partial<{
      sessionId: string;
      nickname: string;
      players: Player[];
      puzzleActive: boolean;
      currentPuzzle: PuzzleData | null;
      endTime?: number | null;
    }>) => {
      console.log('PlayerRoom: Evento "session_joined" recibido', data);
      if (!data || typeof data.nickname !== 'string' || data.nickname.trim() === '') {
        console.error('PlayerRoom: "session_joined" recibido con nickname inválido o faltante.', data);
        setUiError('Error al unirse: datos del servidor incompletos.');
        setIsJoined(false);
        return;
      }
      setIsJoined(true);
      setNickname(data.nickname);
      setPlayers(data.players || []); // Inicializa la lista de jugadores
      setUiError('');

      if (data.puzzleActive && data.currentPuzzle) {
        setInitialPuzzleData(data.currentPuzzle);
        setCurrentFEN(data.currentPuzzle.position || null);
        setPuzzleActive(true);
        setEndTime(data.endTime || null);
      } else {
        setPuzzleActive(false);
        setInitialPuzzleData(null);
        setCurrentFEN(null);
        setEndTime(null);
      }
    };

    const handlePlayerJoined = (data: {
        playerId: string;
        nickname: string;
        score: number;
        players: Player[]; // Lista completa de jugadores
    }) => {
      console.log('PlayerRoom: Evento "player_joined" (otro jugador) recibido', data);
      setPlayers(data.players || []); // Actualiza la lista completa
    };

    const handlePuzzleLaunched = (data: {
      puzzle: PuzzleData;
      endTime: number;
    }) => {
      console.log('PlayerRoom: Evento "puzzle_launched" recibido', data);
      setInitialPuzzleData(data.puzzle);
      setCurrentFEN(data.puzzle.position);
      setPuzzleActive(true);
      setEndTime(data.endTime);
      setShowResults(false);
      setResults(null);
      setUiError('');
      setFeedbackMessage('¡Tu turno! Realiza tu movimiento.');
      setOpponentLastMove(null);
      setSequenceCompleted(false);
      setSequenceFailed(false);
    };

    const handleStepSuccessOpponentMoved = (data: {
        newFEN: string;
        opponentMoveSAN: string;
        nextStepForPlayer: boolean;
    }) => {
        console.log('PlayerRoom: Evento "puzzle_step_success_opponent_moved" recibido', data);
        setCurrentFEN(data.newFEN);
        setOpponentLastMove(data.opponentMoveSAN);
        if (data.nextStepForPlayer) {
            setFeedbackMessage(`¡Correcto! Oponente jugó ${data.opponentMoveSAN}. ¡Tu turno!`);
        } else {
             setFeedbackMessage(`¡Correcto! Oponente jugó ${data.opponentMoveSAN}. Secuencia podría estar completa.`);
        }
    };

    const handleStepFailed = (data: { attemptedMove: string }) => {
        console.log('PlayerRoom: Evento "puzzle_step_failed" recibido', data);
        setFeedbackMessage(`Jugada incorrecta: ${data.attemptedMove}. Intento fallido para este problema.`);
        setSequenceFailed(true);
    };

    const handleSequenceComplete = (data: { playerId?: string; nickname?: string; finalFEN?: string }) => {
        console.log('PlayerRoom: Evento "player_completed_sequence" o "puzzle_sequence_complete" recibido', data);
        if (data.playerId === socket.id || (data.nickname && data.nickname === nickname)) {
            setFeedbackMessage('¡Secuencia completada exitosamente! Esperando resultados.');
            setSequenceCompleted(true);
            if(data.finalFEN) setCurrentFEN(data.finalFEN);
        }
    };

    const handlePlayerCompletedSequence = (data: {playerId: string, nickname: string}) => {
        if (data.nickname !== nickname) { 
            console.log(`Jugador ${data.nickname} ha completado la secuencia.`);
        }
    };
    
    const handlePlayerFailedSequence = (data: { playerId: string; nickname: string }) => {
        console.log('PlayerRoom: Evento "player_failed_sequence" recibido', data);
        if (data.playerId === socket.id || (data.nickname && data.nickname === nickname)) {
            if (data.nickname !== nickname) {
                console.log(`Jugador ${data.nickname} ha fallado la secuencia.`);
            }
        }
    };

    const handleResultsRevealed = (data: {
      solution: string;
      leaderboard: Player[]; // El servidor envía Player[] {id?: string, nickname: string, score: number}
      playerResults: PlayerResult[];
    }) => {
      console.log('PlayerRoom: Evento "results_revealed" recibido', data);
      setResults(data);
      setShowResults(true);
      setPuzzleActive(false);

      // ----- INICIO DE LA CORRECCIÓN PARA ACTUALIZAR PUNTAJES EN WAITING ROOM -----
      if (data.leaderboard) {
        // Asumimos que 'data.leaderboard' es un array de objetos que coinciden con la interfaz Player
        // o que podemos mapear a ella.
        // Si el servidor envía 'id' en el leaderboard y tu interfaz Player aquí lo tiene, se incluirá.
        setPlayers(data.leaderboard.map(p => ({
            id: p.id, // Asegúrate que p.id exista si tu interfaz Player local tiene 'id'
            nickname: p.nickname,
            score: p.score
        })));
        console.log('[PlayerRoom] Estado `players` actualizado con leaderboard:', data.leaderboard);
      }
      // ----- FIN DE LA CORRECCIÓN -----
    };

    const handleNextPuzzle = () => {
      console.log('PlayerRoom: Evento "advanced_to_next_puzzle" recibido');
      setPuzzleActive(false);
      setInitialPuzzleData(null);
      setCurrentFEN(null);
      setEndTime(null);
      setShowResults(false); // Importante: Ocultar los resultados para volver a WaitingRoom
      setResults(null);
      setUiError('');
      setFeedbackMessage('Esperando el siguiente problema...');
      setOpponentLastMove(null);
      setSequenceCompleted(false);
      setSequenceFailed(false);
      // No resetear `players` aquí, ya debe tener los puntajes actualizados por `handleResultsRevealed`.
    };

    const handleSessionEnded = () => {
      alert('La sesión ha terminado. Gracias por jugar. Volviendo a la página de inicio.');
      sessionStorage.removeItem('playerNickname');
      navigate('/');
    };

    const handleErrorEvent = (data: { message: string }) => {
      console.error('PlayerRoom: Error recibido del servidor:', data.message);
      setUiError(data.message);
    };

    socket.on('session_joined', handleSessionJoined);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('puzzle_launched', handlePuzzleLaunched);
    socket.on('puzzle_step_success_opponent_moved', handleStepSuccessOpponentMoved);
    socket.on('puzzle_step_failed', handleStepFailed);
    socket.on('player_completed_sequence', handleSequenceComplete);
    socket.on('player_failed_sequence', handlePlayerFailedSequence);
    socket.on('results_revealed', handleResultsRevealed); // Asegúrate que este handler está definido arriba
    socket.on('advanced_to_next_puzzle', handleNextPuzzle);
    socket.on('session_completed', handleSessionEnded);
    socket.on('error', handleErrorEvent);

    return () => {
      socket.off('session_joined', handleSessionJoined);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('puzzle_launched', handlePuzzleLaunched);
      socket.off('puzzle_step_success_opponent_moved', handleStepSuccessOpponentMoved);
      socket.off('puzzle_step_failed', handleStepFailed);
      socket.off('player_completed_sequence', handleSequenceComplete);
      socket.off('player_failed_sequence', handlePlayerFailedSequence);
      socket.off('results_revealed', handleResultsRevealed);
      socket.off('advanced_to_next_puzzle', handleNextPuzzle);
      socket.off('session_completed', handleSessionEnded);
      socket.off('error', handleErrorEvent);
    };
  }, [socket, navigate, nickname]);

  if (!isJoined && attemptedAutoJoin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="flex justify-center mb-6">
            <ChessIcon size={60} className="text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Unirse a Sesión: <span className="font-mono">{sessionId}</span>
          </h1>
          {!isConnected ? (
            <p className="text-center text-yellow-600">Conectando al servidor...</p>
          ) : (
            <form onSubmit={handleJoinSession} className="space-y-4">
              <div>
                <label htmlFor="nicknameInput" className="block text-sm font-medium text-gray-700 mb-1">
                  Tu Apodo
                </label>
                <input
                  type="text"
                  id="nicknameInput"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setUiError(''); }}
                  placeholder="Ingresa tu apodo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {uiError && <p className="text-red-500 text-sm text-center">{uiError}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                Unirse
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!isConnected && isJoined) { 
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <ChessIcon size={48} className="text-red-600 animate-ping mb-4" />
            <p className="text-xl font-semibold text-gray-700">Conexión perdida con el servidor.</p>
            <p className="text-gray-500">Intentando reconectar... Revisa tu conexión o espera.</p>
        </div>
    );
  } else if (!isConnected) { 
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <ChessIcon size={48} className="text-blue-600 animate-spin mb-4" />
            <p className="text-xl font-semibold text-gray-700">Conectando al servidor de Trebejos Game...</p>
            <p className="text-gray-500">Por favor, espera un momento.</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Trebejos Game - Sesión de Tácticas</h1>
          <p className="text-gray-600">
            ID de Sesión: <span className="font-mono">{sessionId}</span> •
            Jugando como: <span className="font-semibold">{nickname}</span>
          </p>
          {uiError && <p className="text-sm text-red-600 mt-2">{uiError}</p>}
          {opponentLastMove && <p className="text-sm text-blue-600 mt-2">Oponente jugó: <span className="font-mono">{opponentLastMove}</span></p>}
          {feedbackMessage && <p className={`text-sm mt-2 ${sequenceFailed ? 'text-red-600' : sequenceCompleted ? 'text-green-600' : 'text-gray-700'}`}>{feedbackMessage}</p>}
        </div>

        {showResults && results ? (
          <ResultsView
            solution={results.solution}
            leaderboard={results.leaderboard} // results.leaderboard es lo que se pasa a ResultsView
            playerResults={results.playerResults}
            currentPlayerNickname={nickname}
          />
        ) : puzzleActive && initialPuzzleData && currentFEN ? (
          <PuzzleView
            position={currentFEN}
            points={initialPuzzleData.points}
            endTime={endTime || 0}
            onMoveAttempt={handlePlayerMoveAttempt}
            hasSubmittedOrCompleted={sequenceCompleted || sequenceFailed}
            puzzleActive={puzzleActive}
          />
        ) : (
          // WaitingRoom usa el estado 'players' de PlayerRoom
          <WaitingRoom players={players} />
        )}
      </div>
    </div>
  );
};

export default PlayerRoom;