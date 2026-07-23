import asyncio
import json
import websockets
import time
from datetime import datetime

# Global Game States: "LOBBY", "PLAYING"
GAME_STATE = {
    "phase": "LOBBY",
    "players": {}, # Key: websocket, Value: {"name": str, "state": str, "progress": int}
    "game_start_time_ms" : 0,
    "winner_time_ms" : 0,
    "winner_name" : "",
    "nb_players_finished": 0
}


async def broadcast_state():
    """Sends the current list of players and game phase to everyone connected."""
    if not GAME_STATE["players"]:
        return

    # Prepare data payload safely without socket objects
    player_list = []
    for ws, data in GAME_STATE["players"].items():
        player_list.append({
            "name": data["name"],
            "state": data["state"],
            "progress": data["progress"],
            "time": data.get("time", 0) # Optional: Include time if available
        })

    payload = json.dumps({
        "type": "BROADCAST_STATE",
        "phase": GAME_STATE["phase"],
        "players": player_list
    })

    # Send to all active connections
    connected_sockets = list(GAME_STATE["players"].keys())
    if connected_sockets:
        await asyncio.gather(*(ws.send(payload) for ws in connected_sockets))

async def check_players_states():
    if (GAME_STATE["phase"] != "PLAYING"):
        return
    # If no one is left playing/connected, reset room phase
    nbPlaying = sum(1 for p in GAME_STATE["players"].values() if p["state"] == "playing")
    if (not GAME_STATE["players"] or nbPlaying == 0):
        GAME_STATE["phase"] = "LOBBY"
        finish_payload = json.dumps({
            "type": "GAME_OVER",
            "winner": GAME_STATE["winner_name"]
        })
        await asyncio.gather(*(ws.send(finish_payload) for ws in GAME_STATE["players"].keys()))
        await broadcast_state()
        return
    if (GAME_STATE["nb_players_finished"] >=3 or GAME_STATE["nb_players_finished"] == len(GAME_STATE["players"])):
        # Reset server state back to lobby
        GAME_STATE["phase"] = "LOBBY"
        for p in GAME_STATE["players"].values():
            p["state"] = "lobby"
            p["progress"] = 0
            
        finish_payload = json.dumps({
            "type": "GAME_OVER",
            "winner": GAME_STATE["winner_name"]
        })
        await asyncio.gather(*(ws.send(finish_payload) for ws in GAME_STATE["players"].keys()))
        await broadcast_state()


async def check_game_start():
    """Checks if all players in the lobby are ready to start the game."""
    players = GAME_STATE["players"]
    if not players:
        return

    # Check if everyone is "ready" (and ensure there is at least one player)
    all_ready = all(p["state"] == "ready" for p in players.values())

    if all_ready and GAME_STATE["phase"] == "LOBBY":
        GAME_STATE["phase"] = "PLAYING"
        # Shift all players to playing state
        for p in players.values():
            p["state"] = "playing"
            p["progress"] = 0
            p["time"] = 0
        
        print("All players ready. Starting game.")
        GAME_STATE["game_start_time_ms"] = time.time_ns()
        GAME_STATE["winner_time_ms"] = 0
        GAME_STATE["winner_name"] = ""
        GAME_STATE["nb_players_finished"] = 0
        
        start_payload = json.dumps({"type": "GAME_STARTED"})
        await asyncio.gather(*(ws.send(start_payload) for ws in players.keys()))
        await broadcast_state()

async def handle_client(websocket):
    print("New connection established.")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            action = data.get("action")
            now = datetime.now()
            formatted_time = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            header = f"{formatted_time} [{GAME_STATE['phase']}] {action}:"
            # 1. Join Lobby
            if action == "want_to_play":
                # Enforce max 10 players
                if len(GAME_STATE["players"]) >= 10:
                    await websocket.send(json.dumps({"type": "ERROR", "message": "Room full"}))
                    continue

                name = data.get("name", "Unknown")
                
                # If game is ongoing, they join as a spectator/waiting state
                initial_state = "waiting" if GAME_STATE["phase"] == "PLAYING" else "lobby"
                
                GAME_STATE["players"][websocket] = {
                    "name": name,
                    "state": initial_state,
                    "progress": 0,
                    "time": 0 # Optional: Track time if needed for tie-breaking or display
                }
                print(f"{header} Player {name} joined as {initial_state}")
                await broadcast_state()
                await check_players_states()
            
            # 2. Player Ready Toggle
            elif action == "ready_to_play":
                if websocket in GAME_STATE["players"]:
                    current_state = GAME_STATE["players"][websocket]["state"]
                    new_state = "ready" 
                    GAME_STATE["players"][websocket]["state"] = new_state
                    print(f"{header} Player {GAME_STATE['players'][websocket]['name']} changed state from {current_state} to {new_state}")
                    await broadcast_state()
                    await check_players_states()

            elif action == "go_to_lobby":
                if websocket in GAME_STATE["players"]:
                    current_state = GAME_STATE["players"][websocket]["state"]
                    new_state = "lobby" 
                    GAME_STATE["players"][websocket]["state"] = new_state
                    print(f"{header} Player {GAME_STATE['players'][websocket]['name']} changed state from {current_state} to {new_state}")
                    await broadcast_state()
                    await check_players_states()

            elif action == "join_game":
                if websocket in GAME_STATE["players"]:
                    current_state = GAME_STATE["players"][websocket]["state"]
                    new_state = "playing" 
                    GAME_STATE["players"][websocket]["state"] = new_state
                    print(f"{header} Player {GAME_STATE['players'][websocket]['name']} changed state from {current_state} to {new_state}")
                    await broadcast_state()

            elif action == "start_game":
                await check_game_start()


            # 3. Update Progress (During Game)
            elif action == "update_progress":
                if websocket in GAME_STATE["players"] and GAME_STATE["phase"] == "PLAYING":
                    progress = data.get("progress", 0)
                    GAME_STATE["players"][websocket]["progress"] = progress
                    # Broadcast updates frequently during active play
                    await broadcast_state()

            # 4. Game Finished
            elif action == "game_finished":
                if websocket in GAME_STATE["players"] and GAME_STATE["phase"] == "PLAYING":
                    winner_name = GAME_STATE["players"][websocket]["name"]
                    print(f"{header} Player {winner_name} won the game!")

                    # Reset server state back to lobby
                    GAME_STATE["phase"] = "LOBBY"
                    for p in GAME_STATE["players"].values():
                        p["state"] = "lobby"
                        p["progress"] = 0
                        
                    finish_payload = json.dumps({
                        "type": "GAME_OVER",
                        "winner": winner_name
                    })
                    await asyncio.gather(*(ws.send(finish_payload) for ws in GAME_STATE["players"].keys()))
                    await broadcast_state()

            elif action == "player_finished":
                if websocket in GAME_STATE["players"] and GAME_STATE["phase"] == "PLAYING" \
                             and GAME_STATE["players"][websocket]["state"] != "finished":
                    player_name = GAME_STATE["players"][websocket]["name"]
                    GAME_STATE["players"][websocket]["state"]= "finished"
                    time_taken_ms = (time.time_ns() - GAME_STATE["game_start_time_ms"]) // 1_000_000
                    GAME_STATE["players"][websocket]["time"] = time_taken_ms 
                    print(f"{header} Player {player_name} finished the game! {time_taken_ms} ms")
                    
                    winner_time_ms = GAME_STATE["winner_time_ms"]
                    GAME_STATE["nb_players_finished"] += 1
                    if winner_time_ms == 0 :
                        GAME_STATE["winner_time_ms"] = time_taken_ms
                        GAME_STATE["winner_name"] = player_name
                    await check_players_states()
                    await broadcast_state()

            # 5. Explicit Quit
            elif action == "player_quit":
                if websocket in GAME_STATE["players"]:
                    player_name = GAME_STATE["players"][websocket]["name"]
                    
                    if GAME_STATE["phase"] == "PLAYING":
                        # Mid-game quit: Turn them back into a passive lobby member
                        GAME_STATE["players"][websocket]["state"] = "lobby"
                        GAME_STATE["players"][websocket]["progress"] = 0
                        print(f"{header} Player {player_name} quit the active match and returned to lobby.")
                    else:
                        # Lobby phase quit: Remove them entirely so they can go single-player
                        GAME_STATE["players"].pop(websocket)
                        print(f"{header} Player {player_name} left the multiplayer lobby.")
                    await check_players_states()

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Clean up connection when client drops or quits
        if websocket in GAME_STATE["players"]:
            lost_player = GAME_STATE["players"].pop(websocket)
            print(f"{header} Player {lost_player['name']} left or disconnected.")
            
            # If room becomes empty, reset phase
            if not GAME_STATE["players"]:
                GAME_STATE["phase"] = "LOBBY"
            else:
                await broadcast_state()
                # Re-verify readiness in case the disconnecting player was holding up the start
                if GAME_STATE["phase"] == "LOBBY":
                    await check_game_start()

async def main():
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        print("Multiplayer State Server running on ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())