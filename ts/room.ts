import $ from 'jquery';
import { Player } from "./schema/player";
import { gameState, showAlert, switchToDisplayState } from "./index";
import {
  completedGame,
  startedRound,
  sentScores,
  cancelledGame,
  completedRound,
  preparedRound
} from "./game";
import { getCookie } from "./utils";

export async function createNewRoom(playerName: string) {
  try {
    let room = await gameState.client.create("haystack_room", {
      playerName: playerName
    });

    return {
      message: "success",
      room: room
    };
  } catch (e) {
    return {
      message: e
    };
  }
}

export async function joinRoom(roomId: string, playerName: string) {
  // if a cookie with a sessionID for this roomID is found, try to reconnect first
  let roomIdFromCookie = getCookie("roomId");
  let sessionIdFromCookie = getCookie("sessionId");

  if(roomIdFromCookie === roomId && sessionIdFromCookie) {
    try {
      let room = await gameState.client.reconnect(roomId, sessionIdFromCookie);

      return {
        message: "success",
        room: room
      };
    } catch (e) {
      showAlert("danger", "Session expired, joining as a new user");

      // error, try joining anew
      try {
        let room = await gameState.client.joinById(roomId, {
          playerName: playerName
        });

        return {
          message: "success",
          room: room
        };
      } catch (e) {
        // specific message if room was not found
        if(e.code === 4212) {
          return {
            message: "roomNotFound"
          };
        } else if(e.code === 400 && e.message === "usernameTaken") { // username taken
          return {
            message: "usernameTaken"
          };
        } else {
          return {
            message: e
          };
        }
      }
    }
  } else {
    try {
      let room = await gameState.client.joinById(roomId, {
        playerName: playerName
      });

      return {
        message: "success",
        room: room
      };
    } catch (e) {
      // specific message if room was not found
      if(e.code === 4212) {
        return {
          message: "roomNotFound"
        };
      } else if(e.code === 400 && e.message === "usernameTaken") { // username taken
        return {
          message: "usernameTaken"
        };
      } else {
        return {
          message: e
        };
      }
    }
  }
}

export function initRoom() {
  $('#room-id').text(gameState.room!.id);
  $('#room-url').html(`<a href="/room/${gameState.room!.id}" target="_blank">/room/${gameState.room!.id}</a>`);

  // ask users to confirm before they leave
  window.onbeforeunload = (e: any) => {
    e = e || window.event;
    // For IE and Firefox prior to version 4
    if (e) {
      e.returnValue = 'Sure?';
    }
    return 'Sure?';   // Safari
  };

  // refresh members list
  renderFullMembersList();

  // first room state after initialization
  gameState.room!.onStateChange.once((state) => {
    // show admin or non-admin elements
    showRoleElements();

    // refresh settings view from state
    populateSettingsView();

    // if a game is currently running, show a waiting screen
    if(gameState.room!.state.gameActive) {
      switchToDisplayState('hs-state-game-active');
      $('#game-active').removeClass('d-none');
    }
  });

  // listener for new players
  gameState.room!.state.players.onAdd = (player: Player) => {
    addPlayer(JSON.parse(JSON.stringify(player)));

    // force "onChange" to be called immediately
    player.triggerAll();
  };

  // listener for removed players
  gameState.room!.state.players.onRemove = (player: Player) => {
    removePlayer(JSON.parse(JSON.stringify(player)));

    // force "onChange" to be called immediately
    player.triggerAll();
  };

  gameState.room!.onMessage("round/started", (message) => {
    startedRound();
  });

  gameState.room!.onMessage("scores/sent", (message) => {
    sentScores();
  });

  gameState.room!.onMessage("game/completed", (message) => {
    completedGame();
  });

  gameState.room!.onMessage("game/cancelled", (message) => {
    cancelledGame();
  });

  // if a player finishes, update member list
  gameState.room!.onMessage("player/finished", (message) => {
    renderFullMembersList();
  });

  gameState.room!.onMessage("player/left", (message) => {
    // check if current player is now an admin
    if(gameState.room!.state.players.get(gameState.room!.sessionId).admin) {
      showRoleElements();
      showAlert("success", 'You are now the admin');
    }

    // refresh member list
    renderFullMembersList();

    showAlert("warning", `${gameState.room!.state.players.get(message.player).name} has disconnected`);
  });

  gameState.room!.onMessage("player/rejoined", (message) => {
    // refresh member list
    renderFullMembersList();

    // show alert to all other players
    if(message.player !== gameState.room!.sessionId) {
      showAlert("success", `${gameState.room!.state.players.get(message.player).name} has rejoined`);
    } else {
      showAlert("success", 'You have rejoined successfully');
    }
  });

  gameState.room!.onMessage("settings/updated", (message) => {
    // update settings inputs in lobby
    // TODO check if this is fine for admins or only readonly views should be updated (which would be an issue when having multiple admins)
    // alternatively, disable an input after changing it and only re-enable it after receiving the settings/updated msg
    $('.settings-total-rounds').text(message.settings.rounds);
    $('#settings-rounds').val(message.settings.rounds);
  });

  gameState.room!.onMessage("round/prepared", (message) => {
    preparedRound();
  });

  gameState.room!.onMessage("round/completed", (message) => {
    completedRound();
  });
}

function addPlayer(player: Player) {
  // add entry to players list in sidebar
  $('#room-members').append(getMembersListEntry(player));

  // do not show if it's a re-join (i.e. if disconnected was true upon joining)
  if(!player.disconnectedPreviously) {
    // alert for joining user themselves
    if(player.id === gameState.room!.sessionId) {
      showAlert("success", 'You have joined the room');
    } else if(player.timeJoined > gameState.room!.state.players.get(gameState.room!.sessionId).timeJoined) {
      // different alert for other users
      // only show alert if this user has joined AFTER the current user
      showAlert("success", `${player.name} has joined`);
    }
  }
}

function removePlayer(player: Player) {
  // remove player from players list in sidebar
  $(`#players-list-${player.id}`).remove();

  showAlert("warning", `${player.name} has left`);
}

export function showRoleElements() {
  if(gameState.room!.state.players.get(gameState.room!.sessionId).admin === true) {
    $('.admin').removeClass('d-none');
    $('.non-admin').addClass('d-none');
    $('.admin-editable').prop('disabled', false);
  } else {
    $('.non-admin').removeClass('d-none');
    $('.admin').addClass('d-none');
    $('.admin-editable').prop('disabled', true);
  }
}

export function renderFullMembersList() {
  let membersList = '';

  gameState.room!.state.players.forEach((player: Player) => {
    membersList += getMembersListEntry(player);
  })

  // set new list
  $('#room-members').html(membersList);
}

function getMembersListEntry(player: Player) {
  let membersListEntry = `<li id="players-list-${player.id}">`;

  // TODO this probably doesn't output the first char in all cases (emojis etc)
  // TODO also fix for map markers with initial
  membersListEntry += `<div class="hs-player-badge hs-player-badge-${player.color}">${player.name!.slice(0, 1).toUpperCase()}</div>`;

  membersListEntry += player.name;

  if(player.admin === true) {
    membersListEntry += '<span class="badge bg-secondary ms-1">Admin</span>';
  }

  if(player.roundDone && player.inGame) {
    membersListEntry += '<span class="badge bg-success ms-1">Done</span>';
  }

  if(gameState.room!.state.gameActive && !player.inGame && !player.disconnectedCurrently) {
    membersListEntry += '<span class="badge bg-warning ms-1">Not in game</span>';
  }

  if(player.disconnectedCurrently) {
    membersListEntry += `<span class="badge bg-danger ms-1">Inactive</span>`;
  }

  membersListEntry += '</li>';

  return membersListEntry;
}

function populateSettingsView() {
  // rounds
  $('.settings-total-rounds').text(gameState.room!.state.settingRounds);
  $('#settings-rounds').val(gameState.room!.state.settingRounds);
}
