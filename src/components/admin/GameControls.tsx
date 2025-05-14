import React from 'react';
import { PlayCircle, Eye, ArrowRight, RotateCcw } from 'lucide-react';

interface GameControlsProps {
  puzzleActive: boolean;
  showResults: boolean;
  isLastPuzzle: boolean;
  onLaunch: () => void;
  onReveal: () => void;
  onNext: () => void;
  onReset: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  puzzleActive,
  showResults,
  isLastPuzzle,
  onLaunch,
  onReveal,
  onNext,
  onReset
}) => {
  return (
    <div className="flex flex-wrap gap-3">
      {!puzzleActive && !showResults && (
        <button
          onClick={onLaunch}
          className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          <PlayCircle size={20} className="mr-2" />
          Lanzar Problema
        </button>
      )}
      
      {puzzleActive && (
        <button
          onClick={onReveal}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          <Eye size={20} className="mr-2" />
          Revelar Resultados
        </button>
      )}
      
      {showResults && !isLastPuzzle && (
        <button
          onClick={onNext}
          className="flex items-center bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
        >
          <ArrowRight size={20} className="mr-2" />
          Siguiente Problema
        </button>
      )}
      
      <button
        onClick={onReset}
        className="flex items-center bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
      >
        <RotateCcw size={20} className="mr-2" />
        {showResults && isLastPuzzle ? 'Terminar Sesión' : 'Reiniciar Sesión'}
      </button>
    </div>
  );
};

export default GameControls;