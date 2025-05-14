import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard'; // No necesitamos 'Piece' de aquí
import { Chess, Square, Move, PieceSymbol as ChessJsPieceSymbol, Color as ChessJsColor } from 'chess.js'; // Para tipos de chess.js
import { Clock } from 'lucide-react'; // Quité RotateCcw porque el botón de reset se va

// Definición de la nueva interfaz de Props para el flujo automático
interface PuzzleViewProps {
  position: string; // FEN actual que viene de PlayerRoom (currentFEN)
  points: number;
  endTime: number;
  onMoveAttempt: (moveSAN: string) => void; // Para enviar la jugada directamente
  hasSubmittedOrCompleted: boolean; // Para deshabilitar el tablero si falló o completó la secuencia
  puzzleActive: boolean;
  // initialTurn: string; // Ya no es necesario pasarlo como prop, se deriva del FEN 'position'
}

const PuzzleView: React.FC<PuzzleViewProps> = ({
  position,
  points,
  endTime,
  onMoveAttempt,
  hasSubmittedOrCompleted, // Renombrado para claridad
  puzzleActive,
}) => {
  // playerGame es el estado visual del tablero para el jugador, se sincroniza con 'position'
  const [playerGame, setPlayerGame] = useState(new Chess(position));
  const [timeLeft, setTimeLeft] = useState(0);

  // El turno para determinar qué piezas puede mover el jugador se deriva directamente del FEN 'position'
  // que es el estado autoritativo enviado por el servidor.
  let currentTurnForPlayerToMove: ChessJsColor = 'w'; // Valor por defecto
  try {
    currentTurnForPlayerToMove = new Chess(position).turn();
  } catch (e) {
    console.error("Error al determinar el turno desde FEN en PuzzleView:", position, e);
    // En caso de error, podría ser 'w' o manejarlo de otra forma.
  }

  // Sincronizar el estado interno del tablero (playerGame) con la prop 'position'
  useEffect(() => {
    try {
      const newBoardState = new Chess(position);
      setPlayerGame(newBoardState);
      // No es necesario setear initialTurn aquí porque currentTurnForPlayerToMove se recalcula
    } catch (e) {
      console.error('FEN inválido recibido en prop position en PuzzleView:', position, e);
      // Fallback a una posición segura si el FEN es inválido
      setPlayerGame(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1'));
    }
  }, [position]);

  // Lógica del temporizador (sin cambios)
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (endTime === null || !puzzleActive) return 0;
      const difference = endTime - Date.now();
      return Math.max(0, Math.floor(difference / 1000));
    };
    setTimeLeft(calculateTimeLeft());
    if (!puzzleActive || endTime === null || endTime <= Date.now()) {
      return () => {};
    }
    const timerInterval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft <= 0) {
        clearInterval(timerInterval);
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [endTime, puzzleActive]);

  // onPieceDrop ahora llama a onMoveAttempt directamente
  const onPieceDrop = (
    sourceSquare: Square,
    targetSquare: Square,
    piece: string // <--- CORREGIDO: 'piece' es un string como 'wP', 'bN'
  ): boolean => {
    if (hasSubmittedOrCompleted || timeLeft === 0 || !puzzleActive) {
      console.log('PuzzleView: onPieceDrop bloqueado - hasSubmittedOrCompleted:', hasSubmittedOrCompleted, 'timeLeft:', timeLeft, 'puzzleActive:', puzzleActive);
      return false; // No permitir movimiento
    }

    // Validar si la pieza movida pertenece al jugador cuyo turno es (según el FEN actual 'position')
    // La primera letra de 'piece' (ej. 'w' en 'wP') indica el color.
    if (piece[0] !== currentTurnForPlayerToMove) {
        console.log(`PuzzleView: Intento de mover pieza del oponente. Pieza: ${piece}, Turno esperado: ${currentTurnForPlayerToMove}`);
        return false; // No es el turno de esta pieza según el FEN maestro
    }

    // Crear una instancia temporal de chess.js para validar el movimiento y obtener el SAN
    // Usamos 'position' (el FEN maestro del servidor) para asegurar que partimos del estado correcto.
    const gameInstanceForValidation = new Chess(position);
    try {
      const moveResult: Move | null = gameInstanceForValidation.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Asumir promoción a reina por simplicidad
      });

      if (moveResult === null) {
        // Movimiento ilegal según las reglas del ajedrez (ej. rey en jaque, pieza bloqueada)
        console.log('PuzzleView: Movimiento ilegal según chess.js', sourceSquare, targetSquare);
        return false; // Indica a react-chessboard que el movimiento no es válido
      }

      // Si el movimiento es legal según chess.js, llamar a onMoveAttempt con el SAN
      console.log('PuzzleView: Movimiento legal, llamando a onMoveAttempt con SAN:', moveResult.san);
      onMoveAttempt(moveResult.san);

      // NO actualizamos el estado visual local 'playerGame' aquí.
      // La actualización del tablero se basará en el nuevo 'position' (FEN)
      // que PlayerRoom reciba del servidor y pase como prop.
      // Retornar true aquí permite que react-chessboard mueva la pieza visualmente de forma optimista.
      // Si el servidor rechaza la jugada por la lógica de la secuencia, el FEN no cambiará (o cambiará a uno de error)
      // y el tablero se re-renderizará al estado correcto.
      return true;
    } catch (error) {
      // Esto podría ocurrir si hay un error inesperado en chess.js, aunque es raro para .move()
      console.error("Error al procesar movimiento en PuzzleView (onPieceDrop):", error);
      return false;
    }
  };

  // El formulario y los botones de "Realizar Jugada" y "Resetear Jugada" se han eliminado
  // para el flujo automático. Si necesitas un botón de "resetear intento visual" localmente
  // (antes de que el servidor responda), se podría añadir, pero complica el flujo.

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Ajustado para responsividad */}
      <div className="md:col-span-2"> {/* Ajustado para responsividad */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6"> {/* Ajustado padding */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2"> {/* Flex col en small */}
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Resuelve el Problema
            </h2>
            <div className="flex items-center space-x-2 sm:space-x-3"> {/* Espaciado ajustado */}
              <div className={`flex items-center py-1 px-2 sm:px-3 rounded-md text-sm sm:text-base ${
                timeLeft <= 10 && timeLeft > 0 ? 'bg-red-100 text-red-700 animate-pulse' : 
                timeLeft === 0 ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700'
              }`}>
                <Clock size={16} className="mr-1 sm:mr-2" /> {/* Icono más pequeño */}
                <span className="font-mono font-medium">{timeLeft}s</span>
              </div>
              <div className="bg-green-100 text-green-700 py-1 px-2 sm:px-3 rounded-md text-sm sm:text-base">
                <span className="font-medium">{points} pts</span>
              </div>
            </div>
          </div>

          <div className="max-w-full sm:max-w-[500px] md:max-w-[600px] mx-auto"> {/* Ajustado max-width */}
            <Chessboard
              position={position} // Siempre se renderiza el FEN de la prop 'position'
              onPieceDrop={onPieceDrop}
              boardWidth={typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : (typeof window !== 'undefined' && window.innerWidth < 768 ? 400 : 500)} // Tablero responsivo
              arePiecesDraggable={!hasSubmittedOrCompleted && timeLeft > 0 && puzzleActive}
              isDraggablePiece={({ piece }) => // piece es string 'wP', 'bN', etc.
                !hasSubmittedOrCompleted &&
                timeLeft > 0 &&
                puzzleActive &&
                piece[0] === currentTurnForPlayerToMove // Compara el color de la pieza con el turno del FEN
              }
              customDarkSquareStyle={{ backgroundColor: '#779952' }}
              customLightSquareStyle={{ backgroundColor: '#edeed1' }}
              customBoardStyle={{
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Sombra más sutil
              }}
            />
          </div>
        </div>
      </div>

      {/* Sección derecha (antes "Tu Jugada") - Podríamos usarla para un log de jugadas o mensajes */}
      <div className="md:col-span-1">
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">Progreso</h3>
          {/* Aquí podrías mostrar el opponentLastMove o feedbackMessage de PlayerRoom,
              o un pequeño log de la secuencia actual si lo implementas.
              Por ahora, lo dejamos simple. */}
          <div className="text-sm text-gray-600 min-h-[60px]">
            {/* Ejemplo de cómo podrías pasar mensajes desde PlayerRoom:
            <p>{feedbackMessageFromPlayerRoom}</p>
            <p>Oponente jugó: {opponentMoveFromPlayerRoom}</p>
            */}
            {!puzzleActive && !hasSubmittedOrCompleted && <p>Esperando que el administrador lance un problema...</p>}
            {puzzleActive && !hasSubmittedOrCompleted && <p>Es tu turno. Realiza tu movimiento en el tablero.</p>}
            {hasSubmittedOrCompleted && <p>Problema finalizado. Esperando resultados o siguiente problema.</p>}

          </div>
        </div>
      </div>
    </div>
  );
};

export default PuzzleView;