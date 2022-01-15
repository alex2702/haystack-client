import $ from 'jquery';
import * as bootstrap from 'bootstrap';
import '../scss/custom.scss';
import 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'regenerator-runtime/runtime';
import * as Colyseus from "colyseus.js";
import * as HaystackRoom from './room';
import * as HaystackGame from './game';
import { gatherSettingsData, updateSettings } from './game';
import * as State from './state';
import { getCookie, setCookie } from "./utils";

// change to live URL when deploying
export let gameState = new State.GameState(new Colyseus.Client('ws://localhost:2567'));

// enable joining via path
window.onload = () => {
  if(window.location.pathname.startsWith('/room/')) {
    switchToPage('join');
  } else {
    switchToPage('home');
  }

  let playerNameInput = $('#player-name');

  // pre-fill name input from cookie
  playerNameInput.val(getCookie("name") || "");

  // initial check if name is already filled on page load (e.g. from cookie)
  if(playerNameInput.val() && playerNameInput.val()!.toString().length > 3) {
    $('#join-room').prop('disabled', false);
  }

  // enable join button once name has been entered
  playerNameInput.on('change keyup', (e) => {
    if(playerNameInput.val() && playerNameInput.val()!.toString().length > 3) {
      $('#join-room').prop('disabled', false);
    }
  });
};

$('#create-room').on('click', (e) => {
  switchToPage('join');
});

$('#join-room').on('click', (e) => {
  e.preventDefault();

  // validate name input
  let playerName = $('#player-name').val();

  if(playerName && playerName.toString().length > 3) {
    if(window.location.pathname.startsWith('/room/')) {
      let roomIdFromUrl = window.location.pathname.replace('/room/', '');
      HaystackRoom.joinRoom(roomIdFromUrl, playerName!.toString()).then(r => {
        if(r.message === "success" && r.room !== undefined) {
          gameState.room = r.room;

          // save roomId and sessionId to reconnect later
          setCookie("roomId", gameState.room!.id);
          setCookie("sessionId", gameState.room!.sessionId);
          setCookie("name", playerName!.toString());

          HaystackRoom.initRoom();
          showRoomPage();
        } else if(r.message === "roomNotFound") {
          showAlert("danger", "This room was not found");
        } else if(r.message === "usernameTaken") {
          showAlert("danger", "This name is taken. Please choose a different one.");
        } else {
          console.error("Unknown error when joining room", r);
          showAlert("danger", "Unknown error when joining room");
        }
      });
    } else {
      // create new game
      HaystackRoom.createNewRoom(playerName!.toString()).then(r => {
        if(r.message === "success" && r.room !== undefined) {
          gameState.room = r.room;

          // save roomId and sessionId to reconnect later
          setCookie("roomId", gameState.room.id);
          setCookie("sessionId", gameState.room.sessionId);
          setCookie("name", playerName!.toString());

          HaystackRoom.initRoom();
          window.history.pushState('room', 'Room', '/room/' + gameState.room.id);
          showRoomPage();
        } else {
          console.error("Unknown error when creating room", r);
          showAlert("danger", "Unknown error when creating room");
        }
      });
    }
  }
});

$('#start-game').on('click', (e) => {
  HaystackGame.startGame();
});

$('#start-round').on('click', (e) => {
  HaystackGame.startRound();
})

$('#show-scores').on('click', (e) => {
  HaystackGame.sendScores();
});

$('#finish-round').on('click', (e) => {
  HaystackGame.finishRound();
});

$('#cancel-game').on('click', (e) => {
  HaystackGame.cancelGame();
})

// SETTINGS CHANGES
$('#settings-rounds').on('change', (e) => {
  // change number displays
  $('.settings-total-rounds').text($('#settings-rounds').val()!.toString());

  // send settings change to server
  updateSettings(gatherSettingsData());
})

function showRoomPage() {
  switchToPage('room');
  switchToDisplayState('hs-state-lobby');
}

export function switchToPage(page: string) {
  let pages = [
    'home',
    'room',
    'join'
  ];

  pages.forEach((p) => {
    if(p === page) {
      $(`.${p}`).removeClass('d-none');
    } else {
      $(`.${p}`).addClass('d-none');
    }
  });
}

export function switchToDisplayState(state: string) {
  let states = [
    'hs-state-lobby',
    'hs-state-round-prepare',
    'hs-state-round-active',
    'hs-state-round-complete',
    'hs-state-show-scores',
    'hs-state-game-active' // includes round-prepare, round-active, round-complete, game-complete
  ];

  states.forEach((s) => {
    if(s === state) {
      $(`.${s}`).removeClass('d-none');
    } else {
      $(`.${s}:not(.${state})`).addClass('d-none');
    }
  });
}

export function showAlert(type: string, message: string) {
  let alert = $(`\
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">\
        ${message}\
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>\
    </div>`);

  // make alert closable
  let alertInstance = new bootstrap.Alert(alert.get(0) as HTMLElement);

  // set alert to auto-close after 5s
  setTimeout(() => {
    alertInstance.close();
  }, 5000);

  // append to global alerts container
  $('#alerts').append(alert);
}
