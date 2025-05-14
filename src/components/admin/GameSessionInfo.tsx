import React, { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

interface GameSessionInfoProps {
  sessionId: string;
  currentPuzzleIndex: number;
  totalPuzzles: number;
  puzzleActive: boolean;
  showResults: boolean;
}

const GameSessionInfo: React.FC<GameSessionInfoProps> = ({
  sessionId,
  currentPuzzleIndex,
  totalPuzzles,
  puzzleActive,
  showResults
}) => {
  const [copied, setCopied] = useState(false);
  
  const shareableUrl = `${window.location.origin}/game/${sessionId}`;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  let statusText = 'Esperando para iniciar problema';
  let statusColor = 'text-gray-600';
  
  if (puzzleActive) {
    statusText = 'Problema activo';
    statusColor = 'text-green-600';
  } else if (showResults) {
    statusText = 'Mostrando resultados';
    statusColor = 'text-blue-600';
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2"> {/* Ajustado gap para mejor wrapping */}
        <div>
          <span className="text-sm font-medium text-gray-500">ID de Sesión:</span>
          <span className="ml-2 font-mono font-medium text-gray-800">{sessionId}</span>
        </div>
        
        <div>
          <span className="text-sm font-medium text-gray-500">Problema:</span>
          <span className="ml-2 font-medium text-gray-800">{currentPuzzleIndex + 1} de {totalPuzzles}</span>
        </div>
        
        <div>
          <span className="text-sm font-medium text-gray-500">Estado:</span>
          <span className={`ml-2 font-medium ${statusColor}`}>{statusText}</span>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center">
        <span className="text-sm font-medium text-gray-500 mr-2">URL para Compartir:</span>
        <div className="flex-1 flex items-center min-w-[280px]"> {/* min-w para mejor wrapping */}
          <input
            type="text"
            value={shareableUrl}
            readOnly
            className="flex-1 py-1 px-2 text-sm border border-gray-300 rounded-l-md bg-gray-50 focus:outline-none"
            aria-label="URL para compartir"
          />
          <button
            onClick={copyToClipboard}
            title={copied ? "¡Copiado!" : "Copiar URL"}
            className="flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white py-1 px-3 rounded-r-md h-[30px]" // Ajustada altura para alinear con input
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameSessionInfo;