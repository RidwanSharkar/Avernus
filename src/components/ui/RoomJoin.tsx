import React, { useState, useEffect } from 'react';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';

// Extend Window interface to include audioSystem
declare global {
  interface Window {
    audioSystem?: any;
  }
}

interface RoomJoinProps {
  onJoinSuccess: () => void;
  onBack: () => void;
  currentWeapon: WeaponType;
  currentSubclass?: WeaponSubclass;
  gameMode?: 'multiplayer' | 'pvp';
}

export default function RoomJoin({ onJoinSuccess, onBack, currentWeapon, currentSubclass, gameMode = 'multiplayer' }: RoomJoinProps) {
  const {
    joinRoom,
    isConnected,
    isInRoom,
    connectionError,
    players,
    previewRoom,
    clearPreview,
    currentPreview,
    startGame,
    gameStarted,
    roomList,
    requestRoomList
  } = useMultiplayer();
  const [roomId, setRoomId] = useState('default');
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRoomList, setShowRoomList] = useState(true); // Start with room list view
  const [roomListLoading, setRoomListLoading] = useState(false);
  const [roomPreselected, setRoomPreselected] = useState(false); // Track if room was selected from list

  // Clear preview loading when preview is received
  useEffect(() => {
    if (currentPreview) {
      setPreviewLoading(false);
    }
  }, [currentPreview]);

  // Request room list when component mounts and is connected
  useEffect(() => {
    if (isConnected && showRoomList) {
      setRoomListLoading(true);
      requestRoomList();
      // Set loading to false after a short delay to show loading state briefly
      setTimeout(() => setRoomListLoading(false), 500);
    }
  }, [isConnected, showRoomList, requestRoomList]);

  // Auto-refresh room list every 10 seconds when showing room list
  useEffect(() => {
    if (!showRoomList || !isConnected) return;

    const interval = setInterval(() => {
      requestRoomList();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [showRoomList, isConnected, requestRoomList]);

  const handlePreview = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    
    if (!isConnected) {
      alert('Not connected to server. Please wait for connection.');
      return;
    }
    
    setPreviewLoading(true);
    previewRoom(roomId.trim());
    setShowPreview(true);
    
    // Set a timeout to handle non-responsive server
    setTimeout(() => {
      if (previewLoading) {
        setPreviewLoading(false);
        alert('Room preview timed out. Please try again.');
        setShowPreview(false);
      }
    }, 5000);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      alert('Please enter a player name');
      return;
    }

    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    setIsJoining(true);
    try {
      await joinRoom(roomId, playerName.trim(), currentWeapon, currentSubclass, gameMode);
      // Clear preview state
      clearPreview();
      setShowPreview(false);
      // Wait a moment for the room join to complete, then stop joining
      setTimeout(() => {
        setIsJoining(false);
        // Don't automatically start the game - let user click "Start Game" button
      }, 1000);
    } catch (error) {
      console.error('Failed to join room:', error);
      setIsJoining(false);
    }
  };


  const handleBackToForm = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    setShowPreview(false);
    clearPreview();
  };

  const handleBack = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    onBack();
  };

  const handleBackToRoomList = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    setShowRoomList(true);
    setShowPreview(false);
    setRoomPreselected(false);
    clearPreview();
  };

  const handleStartGame = () => {
    // Play interface sound
    if (window.audioSystem) {
      window.audioSystem.playUIInterfaceSound();
    }

    startGame();
    onJoinSuccess(); // Still call this to update UI state
  };

  // If already in room, show room info
  if (isInRoom) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto">
        <div className="relative max-w-md w-11/12 mx-auto">
          {/* Animated background glow */}
          <div className={`absolute -inset-4 rounded-xl blur-lg animate-pulse ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20' : 'bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20'}`}></div>

          {/* Main panel with glassmorphism */}
          <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl p-6 rounded-xl border ${gameMode === 'pvp' ? 'border-red-500/30 shadow-2xl shadow-red-500/10' : 'border-blue-500/30 shadow-2xl shadow-blue-500/10'} text-white text-center`}>
            {/* Enhanced title section */}
            <div className="text-center mb-6 relative">
              {/* Decorative background elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-24 h-px bg-gradient-to-r from-transparent via-${gameMode === 'pvp' ? 'red' : 'blue'}-400 to-transparent opacity-50`}></div>
              </div>

              <h2 className={`text-xl font-black mb-2 bg-gradient-to-r ${gameMode === 'pvp' ? 'from-red-400 via-orange-400 to-red-400' : 'from-blue-400 via-purple-400 to-blue-400'} bg-clip-text text-transparent relative`}>
                {gameMode === 'pvp' ? 'PVP' : 'MULTIPLAYER'} ROOM
              </h2>

              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-8 h-px bg-gradient-to-r from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
                <div className={`text-xs font-medium text-${gameMode === 'pvp' ? 'red' : 'blue'}-300/80 tracking-wider uppercase`}>
                  Room ID: {roomId}
                </div>
                <div className={`w-8 h-px bg-gradient-to-l from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
              </div>
            </div>
        <p className="mb-3 text-sm">Players connected: {players.size}</p>
        <div className="flex flex-col gap-2 mb-4">
          {Array.from(players.values()).map(player => (
            <div key={player.id} className="flex justify-between items-center p-2.5 bg-white/10 rounded-lg border border-gray-600 text-sm">
              <span className="font-bold text-green-500">{player.name}</span>
              <span className="text-orange-500 capitalize">({player.weapon})</span>
            </div>
          ))}
        </div>
            <div className="flex flex-col gap-2.5 items-center mt-4">
              <div className="relative group">
                {/* Button glow effect */}
                <div className={`absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/30 via-orange-500/30 to-red-500/30 opacity-75 group-hover:opacity-100' : 'bg-gradient-to-r from-green-500/30 via-blue-500/30 to-green-500/30 opacity-75 group-hover:opacity-100'}`}></div>

                <button
                  className={`relative px-5 py-2 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full min-w-[200px] max-w-[280px] ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 text-white border-red-400/50 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-500 hover:via-red-400 hover:to-orange-500 hover:border-red-300/70' : 'bg-gradient-to-r from-green-600 via-green-500 to-blue-600 text-white border-green-400/50 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:from-green-500 hover:via-green-400 hover:to-blue-500 hover:border-green-300/70'}`}
                  onClick={handleStartGame}
                  disabled={false}
                >
                  <div className="flex items-center justify-center gap-3">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white">
                      {gameStarted ? 'JOIN GAME' : (gameMode === 'pvp' ? 'START' : 'START GAME')}
                    </span>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </button>
              </div>

              {/* Subtle hint text */}
              <div className="text-center">

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show room list first
  if (showRoomList && !showPreview) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto">
        <div className="relative max-w-2xl w-11/12 mx-auto">
          {/* Animated background glow */}
          <div className={`absolute -inset-4 rounded-xl blur-lg animate-pulse ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20' : 'bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20'}`}></div>

          {/* Main panel with glassmorphism */}
          <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl p-6 rounded-xl border ${gameMode === 'pvp' ? 'border-red-500/30 shadow-2xl shadow-red-500/10' : 'border-blue-500/30 shadow-2xl shadow-blue-500/10'} text-white`}>
            {/* Enhanced title section */}
            <div className="text-center mb-6 relative">
              {/* Decorative background elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-24 h-px bg-gradient-to-r from-transparent via-${gameMode === 'pvp' ? 'red' : 'blue'}-400 to-transparent opacity-50`}></div>
              </div>

              <h1 className={`text-xl font-black mb-2 bg-gradient-to-r ${gameMode === 'pvp' ? 'from-red-400 via-orange-400 to-red-400' : 'from-blue-400 via-purple-400 to-blue-400'} bg-clip-text text-transparent relative`}>
                {gameMode === 'pvp' ? 'PVP' : 'MULTIPLAYER'} ROOMS
              </h1>

              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-8 h-px bg-gradient-to-r from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
                <div className={`text-xs font-medium text-${gameMode === 'pvp' ? 'red' : 'blue'}-300/80 tracking-wider uppercase`}>
                  Active Rooms - {roomList.length} found
                </div>
                <div className={`w-8 h-px bg-gradient-to-l from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
              </div>
            </div>

            {roomListLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <p className="text-gray-300">Loading rooms...</p>
              </div>
            ) : roomList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-300 mb-4">No active rooms found.</p>
                <p className="text-gray-400 text-sm">Be the first to create one!</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                {(() => {
                  const filteredRooms = roomList.filter(room => room.gameMode === gameMode);
                  console.log('Room list state:', { roomList, gameMode, isJoining, filteredRooms });
                  return filteredRooms;
                })()
                  .map((room) => (
                    <div
                      key={room.roomId}
                      className={`relative overflow-hidden rounded-xl transition-all duration-300 transform ${room.playerCount < room.maxPlayers && !isJoining ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-800/80 backdrop-blur-sm border ${room.gameStarted ? 'border-yellow-500/50' : room.playerCount >= room.maxPlayers ? 'border-red-500/50' : room.playerCount < room.maxPlayers && !isJoining ? 'border-green-500/50' : 'border-gray-600/50'} p-4`}
                      onClick={() => {
                        if (room.playerCount < room.maxPlayers && !isJoining) {
                          // Pre-fill the room ID and switch to join form for name entry
                          setRoomId(room.roomId);
                          setRoomPreselected(true);
                          setShowRoomList(false);
                        }
                      }}
                    >
                      {/* Room status indicator */}
                      <div className="absolute top-3 right-3">
                        <div className={`w-3 h-3 rounded-full ${room.gameStarted ? 'bg-yellow-500 animate-pulse' : room.playerCount >= room.maxPlayers ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                      </div>


                      {/* Room header */}
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-white text-lg">{room.roomId}</h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${room.gameStarted ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : room.playerCount >= room.maxPlayers ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                          {room.playerCount}/{room.maxPlayers}
                        </div>
                      </div>

                      {/* Room status */}
                      <div className="text-sm text-gray-300 mb-2">
                        {room.gameStarted ? 'In Progress' : room.playerCount >= room.maxPlayers ? 'Full' : 'Waiting for Players'}
                      </div>

                      {/* Players in room */}
                      {room.players.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-gray-400 font-medium">PLAYERS:</div>
                          {room.players.map(player => (
                            <div key={player.id} className="flex justify-between items-center text-sm">
                              <span className="text-green-400 font-medium">{player.name}</span>
                              <span className="text-orange-400 capitalize">({player.weapon})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <div className="flex-1 relative group">
                <div className={`absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/30 via-orange-500/30 to-red-500/30 opacity-75 group-hover:opacity-100' : 'bg-gradient-to-r from-green-500/30 via-blue-500/30 to-green-500/30 opacity-75 group-hover:opacity-100'}`}></div>
                <button
                  className={`relative w-full px-5 py-3 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 text-white border-red-400/50 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-500 hover:via-red-400 hover:to-orange-500 hover:border-red-300/70' : 'bg-gradient-to-r from-green-600 via-green-500 to-blue-600 text-white border-green-400/50 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:from-green-500 hover:via-green-400 hover:to-blue-500 hover:border-green-300/70'} ${isJoining ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}
                  onClick={() => {
                    // Generate a random room ID for creating new room
                    const randomRoomId = `room_${Math.floor(Math.random() * 10000)}`;
                    setRoomId(randomRoomId);
                    setRoomPreselected(false); // Not pre-selected from list
                    setShowRoomList(false);
                  }}
                  disabled={isJoining}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white">CREATE NEW ROOM</span>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </button>
              </div>

              <div className="flex-1 relative group">
                <div className="absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 bg-gradient-to-r from-gray-500/30 via-gray-600/30 to-gray-500/30 opacity-75 group-hover:opacity-100"></div>
                <button
                  className={`relative w-full px-5 py-3 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-gray-700 to-gray-600 text-white border-gray-600/50 shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-600 hover:to-gray-500 hover:border-gray-500/70 ${isJoining ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}
                  onClick={() => {
                    // Refresh room list
                    setRoomListLoading(true);
                    requestRoomList();
                    setTimeout(() => setRoomListLoading(false), 500);
                  }}
                  disabled={isJoining}
                >
                  REFRESH
                </button>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 bg-gradient-to-r from-gray-500/30 via-gray-600/30 to-gray-500/30 opacity-75 group-hover:opacity-100"></div>
                <button
                  className={`relative px-5 py-3 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-gray-700 to-gray-600 text-white border-gray-600/50 shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-600 hover:to-gray-500 hover:border-gray-500/70 ${isJoining ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}
                  onClick={handleBack}
                  disabled={isJoining}
                >
                  BACK
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show room preview if requested
  if (showPreview && currentPreview) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto">
        <div className="relative max-w-2xl w-11/12 mx-auto">
          {/* Animated background glow */}
          <div className={`absolute -inset-4 rounded-xl blur-lg animate-pulse ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20' : 'bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20'}`}></div>

          {/* Main panel with glassmorphism */}
          <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl p-6 rounded-xl border ${gameMode === 'pvp' ? 'border-red-500/30 shadow-2xl shadow-red-500/10' : 'border-blue-500/30 shadow-2xl shadow-blue-500/10'} text-white`}>
            {/* Enhanced title section */}
            <div className="text-center mb-4 relative">
              {/* Decorative background elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-24 h-px bg-gradient-to-r from-transparent via-${gameMode === 'pvp' ? 'red' : 'blue'}-400 to-transparent opacity-50`}></div>
              </div>

              <h2 className={`text-xl font-black mb-2 bg-gradient-to-r ${gameMode === 'pvp' ? 'from-red-400 via-orange-400 to-red-400' : 'from-blue-400 via-purple-400 to-blue-400'} bg-clip-text text-transparent relative`}>
                {gameMode === 'pvp' ? 'PVP' : 'MULTIPLAYER'} ROOM PREVIEW
              </h2>

              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-8 h-px bg-gradient-to-r from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
                <div className={`text-xs font-medium text-${gameMode === 'pvp' ? 'red' : 'blue'}-300/80 tracking-wider uppercase`}>
                  Room ID: {currentPreview.roomId}
                </div>
                <div className={`w-8 h-px bg-gradient-to-l from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
              </div>
            </div>

            {currentPreview.exists ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-around bg-white/5 p-3 rounded-lg mb-3 text-sm">
              <p className="m-0 font-bold text-green-500">Players: {currentPreview.playerCount}/{currentPreview.maxPlayers}</p>
              {gameMode !== 'pvp' && <p className="m-0 font-bold text-green-500">Enemies: {currentPreview.enemies.length}</p>}
              {gameMode === 'pvp' && <p className="m-0 font-bold text-red-500">Mode: Player vs Player</p>}
            </div>
            
            {currentPreview.playerCount > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-center mb-3">PLAYERS IN ROOM</h3>
                {currentPreview.players.map(player => (
                  <div key={player.id} className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-500 bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-800/80 backdrop-blur-sm border border-gray-700/50 p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg animate-pulse"></div>
                        <span className="font-bold text-green-400">{player.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-orange-400 capitalize font-semibold">({player.weapon})</span>
                        <span className="text-red-400 font-mono text-xs bg-red-900/30 px-2 py-1 rounded">{player.health}/{player.maxHealth} HP</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-white/5 rounded-lg text-gray-300 text-sm">
                <p>This room is empty. You&apos;ll be the first player!</p>
              </div>
            )}
            
            <div className="flex gap-3 mt-4">
              <div className="flex-1 relative group">
                <div className="absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 bg-gradient-to-r from-green-500/30 via-blue-500/30 to-green-500/30 opacity-75 group-hover:opacity-100"></div>
                <button
                  className="relative w-full px-5 py-2 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-green-600 via-green-500 to-blue-600 text-white border-green-400/50 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:from-green-500 hover:via-green-400 hover:to-blue-500 hover:border-green-300/70 disabled:bg-gradient-to-r disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-400 disabled:border-gray-600/50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                  onClick={handleJoin}
                  disabled={isJoining || !playerName.trim() || currentPreview.playerCount >= currentPreview.maxPlayers}
                >
                  {isJoining ? 'JOINING...' :
                   currentPreview.playerCount >= currentPreview.maxPlayers ? 'ROOM FULL' : 'JOIN THIS ROOM'}
                </button>
              </div>
              <div className="flex-1 relative group">
                <div className="absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 bg-gradient-to-r from-gray-500/30 via-gray-600/30 to-gray-500/30 opacity-75 group-hover:opacity-100"></div>
                <button
                  className="relative w-full px-5 py-2 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 bg-gradient-to-r from-gray-700 to-gray-600 text-white border-gray-600/50 shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-600 hover:to-gray-500 hover:border-gray-500/70 disabled:bg-gradient-to-r disabled:from-gray-800 disabled:to-gray-700 disabled:text-gray-500 disabled:border-gray-700/50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                  onClick={handleBackToForm}
                  disabled={isJoining}
                >
                  BACK
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 bg-white/5 rounded-lg text-gray-300 text-sm">
            <p>This room doesn&apos;t exist yet. You&apos;ll create it when you join!</p>
            <div className="flex gap-3 mt-4">
              <button 
                className="flex-1 px-4 py-2 text-sm bg-green-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-green-600 hover:-translate-y-1 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleJoin}
                disabled={isJoining || !playerName.trim()}
              >
                {isJoining ? 'Creating Room...' : 'Create & Join Room'}
              </button>
              <button 
                className="flex-1 px-4 py-2 text-sm bg-gray-600 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-gray-500 hover:-translate-y-1 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleBackToForm}
                disabled={isJoining}
              >
                Back
              </button>
            </div>
          </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 overflow-y-auto">
      <div className="relative max-w-md w-11/12 mx-auto">
        {/* Animated background glow */}
        <div className={`absolute -inset-4 rounded-xl blur-lg animate-pulse ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20' : 'bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20'}`}></div>

        {/* Main panel with glassmorphism */}
        <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl p-6 rounded-xl border ${gameMode === 'pvp' ? 'border-red-500/30 shadow-2xl shadow-red-500/10' : 'border-blue-500/30 shadow-2xl shadow-blue-500/10'} text-white`}>
          {/* Enhanced title section */}
          <div className="text-center mb-4 relative">
            {/* Decorative background elements */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-24 h-px bg-gradient-to-r from-transparent via-${gameMode === 'pvp' ? 'red' : 'blue'}-400 to-transparent opacity-50`}></div>
            </div>

            <h1 className={`text-xl font-black mb-2 bg-gradient-to-r ${gameMode === 'pvp' ? 'from-red-400 via-orange-400 to-red-400' : 'from-blue-400 via-purple-400 to-blue-400'} bg-clip-text text-transparent relative`}>
              {roomPreselected ? 'JOIN ROOM' : (gameMode === 'pvp' ? 'CREATE ROOM' : 'JOIN MULTIPLAYER')}
            </h1>

            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-8 h-px bg-gradient-to-r from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
              <div className={`text-xs font-medium text-${gameMode === 'pvp' ? 'red' : 'blue'}-300/80 tracking-wider uppercase`}>
                {roomPreselected ? 'Enter your name to join' : (gameMode === 'pvp' ? 'Share Room ID to invite an opponent' : 'Choose Your Room')}
              </div>
              <div className={`w-8 h-px bg-gradient-to-l from-transparent to-${gameMode === 'pvp' ? 'red' : 'blue'}-400/60`}></div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="playerName" className={`text-sm font-bold ${gameMode === 'pvp' ? 'text-red-400' : 'text-green-500'}`}>YOUR NAME:</label>
              <input
                id="playerName"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                disabled={isJoining}
                className={`p-2.5 border-2 rounded-lg bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-800/80 backdrop-blur-sm text-white text-sm focus:outline-none focus:border-${gameMode === 'pvp' ? 'red' : 'green'}-500 focus:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed border-gray-600/50 focus:border-opacity-75 transition-all duration-300`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="roomId" className={`text-sm font-bold ${gameMode === 'pvp' ? 'text-red-400' : 'text-green-500'}`}>ROOM ID:</label>
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Room ID (e.g., 'default', 'room1')"
                maxLength={50}
                disabled={isJoining}
                className={`p-2.5 border-2 rounded-lg bg-gradient-to-br from-gray-800/80 via-gray-900/90 to-gray-800/80 backdrop-blur-sm text-white text-sm focus:outline-none focus:border-${gameMode === 'pvp' ? 'red' : 'green'}-500 focus:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed border-gray-600/50 focus:border-opacity-75 transition-all duration-300`}
              />
            </div>

            {connectionError && (
              <div className="bg-red-500/20 border border-red-400 text-red-400 p-3 rounded-lg text-center text-sm">
                Error: {connectionError}
              </div>
            )}

            <div className="flex flex-col gap-2.5 items-center mt-4">
              <div className="relative group">
                <div className={`absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-500/30 via-orange-500/30 to-red-500/30 opacity-75 group-hover:opacity-100' : 'bg-gradient-to-r from-green-500/30 via-blue-500/30 to-green-500/30 opacity-75 group-hover:opacity-100'}`}></div>
                <button
                  className={`relative px-5 py-2 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full min-w-[200px] max-w-[280px] ${gameMode === 'pvp' ? 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 text-white border-red-400/50 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-500 hover:via-red-400 hover:to-orange-500 hover:border-red-300/70' : 'bg-gradient-to-r from-green-600 via-green-500 to-blue-600 text-white border-green-400/50 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:from-green-500 hover:via-green-400 hover:to-blue-500 hover:border-green-300/70'} disabled:bg-gradient-to-r disabled:from-gray-700 disabled:to-gray-600 disabled:text-gray-400 disabled:border-gray-600/50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none`}
                  onClick={handleJoin}
                  disabled={isJoining || !isConnected || !playerName.trim()}
                >
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-white">
                      {isJoining ? 'ENTERING...' : 'ENTER ROOM'}
                    </span>
                    {(!isJoining && isConnected && playerName.trim()) && (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                  </div>
                </button>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1.5 rounded-lg blur-md transition-all duration-500 bg-gradient-to-r from-gray-500/30 via-gray-600/30 to-gray-500/30 opacity-75 group-hover:opacity-100"></div>
                <button
                  className="relative px-5 py-2 text-base font-bold rounded-lg border-2 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full min-w-[200px] max-w-[280px] bg-gradient-to-r from-gray-700 to-gray-600 text-white border-gray-600/50 shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 hover:from-gray-600 hover:to-gray-500 hover:border-gray-500/70 disabled:bg-gradient-to-r disabled:from-gray-800 disabled:to-gray-700 disabled:text-gray-500 disabled:border-gray-700/50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                  onClick={handleBackToRoomList}
                  disabled={isJoining}
                >
                  BACK TO ROOMS
                </button>
              </div>

              {/* Subtle hint text */}
              {gameMode === 'pvp' && (
                <div className="text-center">

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
