import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import { nanoid } from 'nanoid';
import { appendFile } from 'fs/promises';
import path, { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const gameSessions = new Map();

const normalizeSingleMove = (move) => {
  if (typeof move !== 'string') return '';
  return move.trim();
};

const normalizeMainLineString = (movesString) => {
  if (typeof movesString !== 'string') return [];
  return movesString
    .replace(/[0-9]+\.\s*/g, '')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map(move => move.trim())
    .filter(move => move.length > 0);
};

const logActivity = async (eventType, data) => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      event: eventType,
      ...data
    }) + '\n';
    await appendFile(join(__dirname, 'session_activity_log.txt'), logEntry);
  } catch (error) { // Corregido error de sintaxis aquí también si lo tenías
    console.error('Error writing to log file:', error);
  }
};

io.on('connection', (socket) => {
  console.log('[Server] User connected:', socket.id);

  socket.on('create_session', async ({ numPuzzles }) => {
    const sessionId = nanoid(6);
    const initialPuzzles = Array(numPuzzles).fill(null).map(() => ({
        position: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        mainLine: [],
        timer: 60,
        points: 3
    }));

    gameSessions.set(sessionId, {
      id: sessionId,
      admin: socket.id, // Guardamos el socket.id del admin
      numPuzzles,
      currentPuzzleIndex: 0,
      puzzles: initialPuzzles,
      players: new Map(),
      currentPuzzleDataForClient: null,
      puzzleActive: false,
      leaderboard: [],
      currentPuzzleLaunchedAt: null,
    });
    socket.join(sessionId);
    socket.emit('session_created', { sessionId });
    await logActivity('SESSION_CREATED', { sessionId, adminId: socket.id, numPuzzles });
    console.log(`[Server] Session created: ${sessionId} by ${socket.id}`);
  });

  socket.on('join_session', async ({ sessionId, nickname }) => {
    console.log(`[Server] Evento 'join_session' recibido. SessionID: "${sessionId}", Nickname: "${nickname}"`);
    const session = gameSessions.get(sessionId);

    if (!session) {
      console.error(`[Server] Intento de unirse a sesión no existente: ${sessionId} por socket ${socket.id}`);
      socket.emit('error', { message: 'Sesión de juego no encontrada o ha expirado.' });
      return;
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim() === '') {
      console.warn(`[Server] Intento de unirse a sesión ${sessionId} con nickname inválido o vacío por socket ${socket.id}.`);
      socket.emit('error', { message: 'El apodo no puede estar vacío.' });
      return;
    }

    const trimmedNickname = nickname.trim();
    let isNicknameTaken = false;
    for (const player of session.players.values()) {
        if (player.nickname === trimmedNickname) {
            isNicknameTaken = true;
            break;
        }
    }
    // Considera manejar isNicknameTaken si es un problema

    session.players.set(socket.id, {
      id: socket.id,
      nickname: trimmedNickname,
      score: 0,
      lastSubmittedMove: null,
      currentAnswerTimestamp: null,
      currentMainLineStep: 0,
      currentAttemptFEN: session.puzzleActive && session.currentPuzzleDataForClient ? session.currentPuzzleDataForClient.position : null,
      sequenceCompletedSuccessfully: false,
      sequenceFailed: false,
      finalTimestampForSequence: null,
    });

    socket.join(sessionId);
    const currentPlayers = Array.from(session.players.values()).map(p => ({ id: p.id, nickname: p.nickname, score: p.score })); // Incluir ID

    const payloadForSessionJoined = {
      sessionId: session.id,
      nickname: trimmedNickname,
      players: currentPlayers,
      puzzleActive: session.puzzleActive,
      currentPuzzle: session.puzzleActive ? session.currentPuzzleDataForClient : null,
      endTime: session.puzzleActive && session.currentPuzzleLaunchedAt && session.puzzles[session.currentPuzzleIndex]
               ? session.currentPuzzleLaunchedAt + (session.puzzles[session.currentPuzzleIndex].timer * 1000)
               : null,
    };
    console.log('[Server] Enviando "session_joined" con payload:', payloadForSessionJoined);
    socket.emit('session_joined', payloadForSessionJoined);

    const playerJoinedPayload = {
        playerId: socket.id,
        nickname: trimmedNickname,
        score: 0,
        players: currentPlayers
    };
    console.log('[Server] Enviando "player_joined" a sala', sessionId, 'con payload:', playerJoinedPayload)
    io.to(sessionId).emit('player_joined', playerJoinedPayload);

    await logActivity('PLAYER_JOINED', { sessionId, playerId: socket.id, nickname: trimmedNickname });
    console.log(`[Server] Player ${trimmedNickname} (ID: ${socket.id}) joined session ${sessionId}. Total players: ${session.players.size}`);
  });

  socket.on('update_puzzle', async ({ sessionId, puzzleIndex, puzzle }) => {
    const session = gameSessions.get(sessionId);
    if (!session || session.admin !== socket.id) {
        socket.emit('error', { message: 'No autorizado o sesión no encontrada.' });
        return;
    }
    if (puzzleIndex >= 0 && puzzleIndex < session.puzzles.length) {
      const mainLineArray = normalizeMainLineString(puzzle.mainLine || '');
      session.puzzles[puzzleIndex] = {
        position: puzzle.position,
        mainLine: mainLineArray,
        timer: parseInt(puzzle.timer, 10) || 60,
        points: parseInt(puzzle.points, 10) || 3
      };
      console.log(`[Server] Puzzle ${puzzleIndex} updated in session ${sessionId} by admin ${socket.id}. MainLine: ${mainLineArray.join(' | ')}`);
      await logActivity('PUZZLE_UPDATED', { sessionId, puzzleIndex, adminId: socket.id, mainLineLength: mainLineArray.length });
    } else {
        socket.emit('error', {message: 'Índice de problema inválido.'})
    }
  });

  socket.on('launch_puzzle', async ({ sessionId, puzzleIndex }) => {
    const session = gameSessions.get(sessionId);
    if (!session || session.admin !== socket.id) {
      socket.emit('error', { message: 'No autorizado o sesión no encontrada.' });
      return;
    }
    if (puzzleIndex >= 0 && puzzleIndex < session.puzzles.length) {
      const puzzleToLaunch = session.puzzles[puzzleIndex];
      if (!puzzleToLaunch || !puzzleToLaunch.position || !Array.isArray(puzzleToLaunch.mainLine) || puzzleToLaunch.mainLine.length === 0) {
        socket.emit('error', { message: 'El ejercicio debe tener una posición FEN y una línea principal de jugadas (SAN) configurada.' });
        return;
      }
      session.currentPuzzleDataForClient = {
        position: puzzleToLaunch.position,
        timer: puzzleToLaunch.timer,
        points: puzzleToLaunch.points
      };
      session.currentPuzzleIndex = puzzleIndex;
      session.puzzleActive = true;
      session.currentPuzzleLaunchedAt = Date.now();
      session.players.forEach(player => {
        player.lastSubmittedMove = null;
        player.currentAnswerTimestamp = null;
        player.currentMainLineStep = 0;
        player.currentAttemptFEN = puzzleToLaunch.position;
        player.sequenceCompletedSuccessfully = false;
        player.sequenceFailed = false;
        player.finalTimestampForSequence = null;
      });
      const launchPayload = {
          puzzle: session.currentPuzzleDataForClient,
          endTime: session.currentPuzzleLaunchedAt + (puzzleToLaunch.timer * 1000),
      };
      io.to(sessionId).emit('puzzle_launched', launchPayload);
      console.log(`[Server] Puzzle ${puzzleIndex} launched in session ${sessionId}. Payload:`, launchPayload);
      await logActivity('PUZZLE_LAUNCHED', { sessionId, puzzleIndex, adminId: socket.id });
    } else {
        socket.emit('error', { message: 'Índice de problema inválido para lanzar.' });
    }
  });

  socket.on('submit_answer', async ({ sessionId, answer: playerSingleMoveSAN_raw }) => {
    const session = gameSessions.get(sessionId);
    if (!session || !session.puzzleActive) {
      socket.emit('error', { message: 'Sesión no encontrada o ejercicio no activo.' });
      return;
    }
    const player = session.players.get(socket.id);
    if (!player) {
        socket.emit('error', { message: 'Jugador no encontrado en la sesión.'});
        return;
    }
    if (player.sequenceFailed || player.sequenceCompletedSuccessfully) {
      socket.emit('error', { message: 'No puedes enviar más jugadas para este problema.' });
      return;
    }
    const currentPuzzleConfig = session.puzzles[session.currentPuzzleIndex];
    if (!currentPuzzleConfig || !currentPuzzleConfig.mainLine || currentPuzzleConfig.mainLine.length === 0) {
      socket.emit('error', { message: 'Error interno: problema no configurado correctamente.' });
      return;
    }

    // ----- INICIO: Lógica para notificar al admin -----
    const adminSocketId = session.admin; // Obtener el socket ID del admin de la sesión
    console.log(`[Server] En submit_answer para sesión ${sessionId}: adminSocketId es ${adminSocketId}. El creador de la sesión fue ${session.admin}`);
    // ----- FIN: Lógica para notificar al admin -----

    const playerSubmittedMoveSAN = normalizeSingleMove(playerSingleMoveSAN_raw);
    player.lastSubmittedMove = playerSubmittedMoveSAN;
    player.currentAnswerTimestamp = Date.now();
    await logActivity('PLAYER_ATTEMPTED_MOVE', {
        sessionId, playerId: socket.id, nickname: player.nickname,
        puzzleIndex: session.currentPuzzleIndex, step: player.currentMainLineStep, move: playerSubmittedMoveSAN
    });
    console.log(`[Server] Jugador ${player.nickname} (socket ${socket.id}) en sesión ${sessionId} intentó jugada: ${playerSubmittedMoveSAN} para paso ${player.currentMainLineStep}. FEN actual del jugador: ${player.currentAttemptFEN}`);

    const mainLine = currentPuzzleConfig.mainLine;
    const expectedMoveSAN = mainLine[player.currentMainLineStep];
    if (typeof expectedMoveSAN === 'undefined') {
        console.error(`[Server] Error crítico: No se encontró la jugada esperada en la mainLine para el paso ${player.currentMainLineStep}. Mainline: ${mainLine.join(' ')}. Sesión: ${sessionId}, Jugador: ${player.nickname}`);
        socket.emit('error', { message: 'Error en la secuencia del problema. Contacta al administrador.'});
        player.sequenceFailed = true;
        const failedPayloadAll = { playerId: socket.id, nickname: player.nickname, lastAttemptedMove: player.lastSubmittedMove };
        console.log('[Server] Emitiendo "player_failed_sequence" (paso no encontrado) a sala', sessionId, 'con payload:', failedPayloadAll);
        io.to(sessionId).emit('player_failed_sequence', failedPayloadAll);
        return;
    }

    const gameInstance = new Chess(player.currentAttemptFEN);
    let moveResult = null;
    try {
        moveResult = gameInstance.move(playerSubmittedMoveSAN, { sloppy: true });
    } catch (e) {
        console.warn(`[Server] Chess.js error al validar jugada "${playerSubmittedMoveSAN}" en FEN "${player.currentAttemptFEN}" para ${player.nickname}: ${e.message}`);
    }

    const madeMoveSAN = moveResult ? moveResult.san : null;
    const normalizedExpectedSan = normalizeSingleMove(expectedMoveSAN);

    if (moveResult && madeMoveSAN && madeMoveSAN.toLowerCase() === normalizedExpectedSan.toLowerCase()) {
      player.currentAttemptFEN = gameInstance.fen();
      player.currentMainLineStep++;
      console.log(`[Server] Jugador ${player.nickname} CORRECTO en paso ${player.currentMainLineStep -1}. Nuevo FEN: ${player.currentAttemptFEN}`);

      if (player.currentMainLineStep < mainLine.length) {
        const opponentMoveSAN = mainLine[player.currentMainLineStep];
        const gameAfterPlayerMove = new Chess(player.currentAttemptFEN);
        let opponentMoveResult = null;
        try {
            opponentMoveResult = gameAfterPlayerMove.move(opponentMoveSAN, { sloppy: true });
        } catch(e) {
             console.error(`[Server] ERROR CRÍTICO (Admin Def): Jugada del oponente '${opponentMoveSAN}' es ilegal desde FEN ${player.currentAttemptFEN}. Sesión: ${sessionId}. Error: ${e.message}`);
             socket.emit('error', { message: 'Error en la definición del problema (jugada oponente ilegal). Contacta al administrador.' });
             player.sequenceFailed = true;
             const failedCriticalPayload = { playerId: socket.id, nickname: player.nickname, lastAttemptedMove: player.lastSubmittedMove };
             console.log('[Server] Emitiendo "player_failed_sequence" (error crítico oponente) a sala', sessionId, 'con payload:', failedCriticalPayload);
             io.to(sessionId).emit('player_failed_sequence', failedCriticalPayload);
             return;
        }

        if (opponentMoveResult) {
          player.currentAttemptFEN = gameAfterPlayerMove.fen();
          player.currentMainLineStep++;
          console.log(`[Server] Oponente para ${player.nickname} movió ${opponentMoveResult.san}. Nuevo FEN: ${player.currentAttemptFEN}. Siguiente paso para jugador: ${player.currentMainLineStep}`);
          const isNextStepForPlayer = player.currentMainLineStep < mainLine.length;
          socket.emit('puzzle_step_success_opponent_moved', {
            newFEN: player.currentAttemptFEN,
            opponentMoveSAN: opponentMoveResult.san,
            nextStepForPlayer: isNextStepForPlayer,
          });

          // ----- EMISIÓN DE admin_player_progress (JUGADA CORRECTA + OPONENTE MOVIÓ) -----
          if (adminSocketId) {
              const progressPayloadForAdmin = {
                  playerId: socket.id,
                  nickname: player.nickname,
                  attemptedMoveSAN: madeMoveSAN, // La jugada SAN validada del jugador
                  timestamp: Date.now(),
                  status: 'solving_correct_step',
                  opponentMoveSAN: opponentMoveResult.san,
                  isNextStepForPlayer
              };
              console.log('[Server] PREPARANDO PARA EMITIR "admin_player_progress" (correcto+oponente) a admin', adminSocketId, 'con payload:', progressPayloadForAdmin);
              io.to(adminSocketId).emit('admin_player_progress', progressPayloadForAdmin);
          }
          // ----- FIN EMISIÓN -----

          if (!isNextStepForPlayer) {
            player.sequenceCompletedSuccessfully = true;
            player.finalTimestampForSequence = player.currentAnswerTimestamp;
            console.log(`[Server] Jugador ${player.nickname} completó la secuencia (oponente hizo la última jugada).`);
            const completedPayload = { playerId: socket.id, nickname: player.nickname, finalFEN: player.currentAttemptFEN, timeTakenMs: player.finalTimestampForSequence - (session.currentPuzzleLaunchedAt || player.currentAnswerTimestamp) };
            console.log('[Server] Emitiendo "player_completed_sequence" a sala', sessionId, 'con payload:', completedPayload);
            io.to(sessionId).emit('player_completed_sequence', completedPayload);
          }
        } else {
          console.error(`[Server] ERROR CRÍTICO (Admin Def): Jugada del oponente '${opponentMoveSAN}' es ilegal desde FEN ${player.currentAttemptFEN}. Sesión: ${sessionId}`);
          socket.emit('error', { message: 'Error en la definición del problema (jugada oponente ilegal). Contacta al administrador.' });
          player.sequenceFailed = true;
          const failedIllegalOpponentPayload = { playerId: socket.id, nickname: player.nickname, lastAttemptedMove: player.lastSubmittedMove };
          console.log('[Server] Emitiendo "player_failed_sequence" (oponente ilegal) a sala', sessionId, 'con payload:', failedIllegalOpponentPayload);
          io.to(sessionId).emit('player_failed_sequence', failedIllegalOpponentPayload);
        }
      } else { // Jugador hizo la última jugada y fue correcta (no hay jugada de oponente después)
        player.sequenceCompletedSuccessfully = true;
        player.finalTimestampForSequence = player.currentAnswerTimestamp;
        console.log(`[Server] Jugador ${player.nickname} completó la secuencia (hizo la última jugada).`);
        const completedPayloadLastMove = { playerId: socket.id, nickname: player.nickname, finalFEN: player.currentAttemptFEN, timeTakenMs: player.finalTimestampForSequence - (session.currentPuzzleLaunchedAt || player.currentAnswerTimestamp) };
        console.log('[Server] Emitiendo "player_completed_sequence" (última jugada) a sala', sessionId, 'con payload:', completedPayloadLastMove);
        io.to(sessionId).emit('player_completed_sequence', completedPayloadLastMove);

        // ----- EMISIÓN DE admin_player_progress (JUGADOR COMPLETÓ CON SU ÚLTIMA JUGADA) -----
        // Aunque 'player_completed_sequence' ya se envía a la sala,
        // un evento específico a admin_player_progress podría ser redundante o útil si el admin
        // no procesa 'player_completed_sequence' para actualizar el progreso visual intermedio.
        // Por ahora, confiamos en que AdminDashboard escucha 'player_completed_sequence'.
        // Si se necesita, se puede añadir aquí una emisión similar a 'admin_player_progress' con status 'completed'.
      }
    } else { // Jugada del jugador INCORRECTA
      player.sequenceFailed = true;
      console.log(`[Server] Jugador ${player.nickname} INCORRECTO. Esperada (aprox): ${normalizedExpectedSan}, Recibida: ${playerSubmittedMoveSAN} (chess.js SAN: ${madeMoveSAN}). FEN: ${player.currentAttemptFEN}`);
      socket.emit('puzzle_step_failed', {
        attemptedMove: playerSubmittedMoveSAN,
      });
      const failedIncorrectPayload = { playerId: socket.id, nickname: player.nickname, lastAttemptedMove: player.lastSubmittedMove };
      console.log('[Server] Emitiendo "player_failed_sequence" (incorrecto) a sala', sessionId, 'con payload:', failedIncorrectPayload);
      io.to(sessionId).emit('player_failed_sequence', failedIncorrectPayload);

      // ----- EMISIÓN DE admin_player_progress (JUGADA INCORRECTA) -----
      if (adminSocketId) {
          const progressPayloadForAdmin = {
              playerId: socket.id,
              nickname: player.nickname,
              attemptedMoveSAN: playerSubmittedMoveSAN,
              timestamp: Date.now(),
              status: 'solving_incorrect_step',
              expectedMoveSAN: normalizedExpectedSan, // Para que el admin vea qué se esperaba
          };
          console.log('[Server] PREPARANDO PARA EMITIR "admin_player_progress" (incorrecto) a admin', adminSocketId, 'con payload:', progressPayloadForAdmin);
          io.to(adminSocketId).emit('admin_player_progress', progressPayloadForAdmin);
      }
      // ----- FIN EMISIÓN -----
    }
  });

  socket.on('reveal_results', async ({ sessionId }) => {
    const session = gameSessions.get(sessionId);
    if (!session || session.admin !== socket.id) {
        socket.emit('error', { message: 'No autorizado o sesión no encontrada.' });
        return;
    }
    if (!session.puzzles[session.currentPuzzleIndex]) {
        socket.emit('error', {message: 'Problema actual no encontrado para revelar resultados.'});
        return;
    }
    session.puzzleActive = false;
    const puzzleBeingRevealed = session.puzzles[session.currentPuzzleIndex];
    const mainLineSolution = puzzleBeingRevealed.mainLine;
    const basePoints = puzzleBeingRevealed.points;
    const maxTimeSeconds = puzzleBeingRevealed.timer;
    const playerResultsForEmit = [];
    session.players.forEach(player => {
      let pointsAwardedThisRound = 0;
      let timeTakenForDisplay = null;
      const isCorrect = player.sequenceCompletedSuccessfully === true && player.sequenceFailed === false;
      if (isCorrect && player.finalTimestampForSequence && session.currentPuzzleLaunchedAt) {
          let timeTakenSeconds = (player.finalTimestampForSequence - session.currentPuzzleLaunchedAt) / 1000;
          timeTakenSeconds = Math.max(0, Math.min(timeTakenSeconds, maxTimeSeconds));
          const proportionOfTimeUnused = maxTimeSeconds > 0 ? (1 - (timeTakenSeconds / maxTimeSeconds)) : (timeTakenSeconds === 0 ? 1 : 0);
          const actualBonusMultiplier = 1.0 * proportionOfTimeUnused;
          const finalMultiplier = 1 + actualBonusMultiplier;
          pointsAwardedThisRound = basePoints * finalMultiplier;
          pointsAwardedThisRound = Math.round(pointsAwardedThisRound * 100) / 100;
          player.score += pointsAwardedThisRound;
          timeTakenForDisplay = parseFloat(timeTakenSeconds.toFixed(1));
      }
      playerResultsForEmit.push({
        playerId: player.id, nickname: player.nickname,
        answer: player.lastSubmittedMove || '(Sin respuesta)',
        isCorrect,
        pointsAwarded: pointsAwardedThisRound,
        timeTaken: timeTakenForDisplay
      });
    });
    session.leaderboard = Array.from(session.players.values())
      .map(p => ({ id:p.id, nickname: p.nickname, score: parseFloat(p.score.toFixed(2)) })) // Incluir ID
      .sort((a, b) => b.score - a.score);
    const resultsPayload = {
      solution: mainLineSolution.join(' \u2192 '),
      leaderboard: session.leaderboard,
      playerResults: playerResultsForEmit,
    };
    io.to(sessionId).emit('results_revealed', resultsPayload);
    console.log(`[Server] Results revealed for puzzle ${session.currentPuzzleIndex} in session ${sessionId}. Payload:`, resultsPayload);
    await logActivity('RESULTS_REVEALED', { sessionId, puzzleIndex: session.currentPuzzleIndex, adminId: socket.id });
  });

  socket.on('next_puzzle', async ({ sessionId }) => {
    const session = gameSessions.get(sessionId);
    if (!session || session.admin !== socket.id) {
        socket.emit('error', { message: 'No autorizado o sesión no encontrada.' });
        return;
    }
    const nextIndex = session.currentPuzzleIndex + 1;
    if (nextIndex < session.numPuzzles) {
      session.currentPuzzleIndex = nextIndex;
      session.puzzleActive = false;
      session.currentPuzzleDataForClient = null;
      session.currentPuzzleLaunchedAt = null;
      const nextPuzzlePayload = {
          nextPuzzleIndex: nextIndex,
          numPuzzles: session.numPuzzles
      };
      io.to(sessionId).emit('advanced_to_next_puzzle', nextPuzzlePayload);
      console.log(`[Server] Advanced to next puzzle config. Index: ${nextIndex} in session ${sessionId}.`);
      await logActivity('ADVANCED_TO_NEXT_PUZZLE', { sessionId, nextPuzzleIndex: nextIndex, adminId: socket.id });
    } else {
      console.log(`[Server] All puzzles completed for session ${sessionId}. Admin can choose to end or reset.`);
      io.to(sessionId).emit('session_completed', {
          message: "Todos los problemas han sido completados.",
          leaderboard: session.leaderboard
      });
      await logActivity('SESSION_COMPLETED', { sessionId, adminId: socket.id });
    }
  });

  socket.on('disconnect', async () => {
    console.log('[Server] User disconnected:', socket.id);
    for (const [sessionId, session] of gameSessions.entries()) {
      if (session.admin === socket.id) {
        console.log(`[Server] Admin ${socket.id} disconnected from session ${sessionId}. Notifying players.`);
        io.to(sessionId).emit('admin_disconnected', { message: 'El administrador se ha desconectado. La sesión puede terminar pronto.' });
      } else if (session.players.has(socket.id)) {
        const player = session.players.get(socket.id);
        console.log(`[Server] Player ${player.nickname} (ID: ${socket.id}) disconnected from session ${sessionId}.`);
        session.players.delete(socket.id);
        await logActivity('PLAYER_DISCONNECTED', { sessionId, playerId: socket.id, nickname: player.nickname });
        const currentPlayers = Array.from(session.players.values()).map(p => ({ id: p.id, nickname: p.nickname, score: p.score })); // Incluir ID
        io.to(sessionId).emit('player_left', {
            playerId: socket.id,
            nickname: player.nickname,
            players: currentPlayers
        });
        console.log(`[Server] Notified session ${sessionId} about player ${player.nickname} leaving. Remaining players: ${session.players.size}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Server running on port ${PORT}`);
});