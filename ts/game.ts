import L, { LatLng, LatLngBounds } from "leaflet";
import * as Geodesic from "leaflet.geodesic";
import { gameState, showAlert, switchToDisplayState } from "./index";
import { Player } from "./schema/player";
import $ from "jquery";
import * as HaystackRoom from './room';
import { renderFullMembersList } from "./room";

export function updateSettings(settings: object) {
  if(currentUserIsAdmin()) {
    gameState.room!.send("settings/update", {
      settings
    });
  }
}

export function startGame() {
  if(currentUserIsAdmin()) {
    gameState.room!.send("game/start", {
      settings: gatherSettingsData()
    });
  }
}

// called from index via incoming message "round/prepared"
export function preparedRound() {
  if(currentUserIsInGame()) {
    switchToDisplayState('hs-state-round-prepare');

    // update round counter
    $('.current-round-number').text(gameState.room!.state.currentRoundCounter);

    // init map here
    initMap();
  }
}

export function startRound() {
  if(currentUserIsAdmin() && currentUserIsInGame()) {
    gameState.room!.send("round/start", {});
  }
}

// called from index via incoming message "round/started"
export function startedRound() {
  if(currentUserIsInGame()) {
    // show city to be found
    $('#map-current-target').text(gameState.room!.state.currentTarget);

    // start clock
    // TODO start clock once time limit is implemented

    // show active round screen
    switchToDisplayState('hs-state-round-active');

    // reset map
    gameState.map!.invalidateSize()
  }
}

// called from index via incoming message "round/completed"
export function completedRound() {
  if(currentUserIsInGame()) {
    switchToDisplayState('hs-state-round-complete');

    renderFullMembersList();

    // remove own marker (later use the one that the server sent)
    removeAllMapMarkers();

    // record all markers for auto-zooming the map
    let mapBounds = new Array<LatLng>();

    // show marker of target location
    let targetLatLng = new LatLng(gameState.room!.state.lastTargetLat, gameState.room!.state.lastTargetLng).wrap();
    let targetMarker = L.marker(targetLatLng, {
      icon: L.divIcon({
        className: 'pin pin-target',
        iconSize: [30, 44],
        iconAnchor: [15, 44]
      })
    }).bindTooltip(gameState.room!.state.currentTarget, {permanent: true});
    targetMarker.addTo(gameState.map!);
    gameState.currentMapMarkers.push(targetMarker);
    mapBounds.push(targetLatLng);

    // for each player, add a marker with the guess and a line to the target
    gameState.room!.state.players.forEach((player: Player) => {
      if(player.inGame) {
        let playerLatLng = wrapClosestToTarget(targetLatLng, new LatLng(player.lastGuessLat, player.lastGuessLng));

        let marker = L.marker(playerLatLng, {
          icon: L.divIcon({
            className: `pin pin-${player.color} pin-user`,
            iconSize: [30, 44],
            iconAnchor: [15, 44],
            html: `<span>${player.name!.slice(0, 1).toUpperCase()}</span>`
          })
        }).bindTooltip(`${player.name!}<br />${Math.round(player.lastDistance).toLocaleString(window.navigator.language)} km`, {permanent: true});
        marker.addTo(gameState.map!);
        gameState.currentMapMarkers.push(marker);
        mapBounds.push(playerLatLng);
        let line = new Geodesic.GeodesicLine([targetLatLng, playerLatLng], {
          color: `#${player.color}`,
          weight: 4,
          opacity: 0.8,
          steps: 6,
          wrap: false
        });
        line.addTo(gameState.map!);
        gameState.currentMapMarkers.push(line);
      }
    });

    // increase max zoom for results
    gameState.map!.setMaxZoom(10);

    // auto-zoom map to correct level
    gameState.map!.fitBounds(L.latLngBounds(mapBounds), { padding: [10, 10] });

    // disable crosshair cursor
    L.DomUtil.removeClass(gameState.map!.getContainer(),'crosshair-cursor-enabled');
  }
}

export function sendScores() {
  if(currentUserIsAdmin() && currentUserIsInGame()) {
    gameState.room!.send("scores/send", {});
  }
}

// called from index via incoming message "scores/sent"
export function sentScores() {
  renderScores();
  $('.current-round-number').text(gameState.room!.state.currentRoundCounter);
  switchToDisplayState('hs-state-show-scores');
}

export function finishRound() {
  if(currentUserIsAdmin() && currentUserIsInGame()) {
    gameState.room!.send("round/finish", {});
  }
}

// called from index via incoming message "game/completed"
export function completedGame() {
  switchToDisplayState('hs-state-lobby');
  gameState.room!.removeAllListeners();
  HaystackRoom.initRoom();
}

export function cancelGame() {
  if(currentUserIsAdmin() && currentUserIsInGame()) {
    gameState.room!.send("game/cancel", {});
  }
}

// called from index via incoming message "game/cancelled"
export function cancelledGame() {
  switchToDisplayState('hs-state-lobby');
  showAlert("danger", "The game was cancelled");
  gameState.room!.removeAllListeners();
  HaystackRoom.initRoom();
}

function initMap() {
  // create new map if none exists (from past games)
  if(gameState.map === undefined) {
    // create map object
    // TODO check if it's possible to prevent map "wrapping"
    gameState.map = L.map('mapid', {
      //worldCopyJump: true,
      minZoom: 1,
      maxBoundsViscosity: 1.0,
      maxBounds: new LatLngBounds([[-90, -18000], [90, 18000]])
    });

    // add map tiles
    let tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 10
    }).addTo(gameState.map);

    // handle clicks
    gameState.map.on('click', makeGuessOnMap);
  }

  // set default view and zoom
  gameState.map.fitWorld();
  // TODO fix this when layout is final (on mobile, there are borders on top and bottom)

  // set max zoom back to 6 (10 is only for showing results)
  gameState.map.setMaxZoom(6);

  // enable crosshair cursor
  L.DomUtil.addClass(gameState.map.getContainer(),'crosshair-cursor-enabled');

  // remove any markers that may exist from before
  removeAllMapMarkers();
}

function makeGuessOnMap(e: any) {
  // only processes clicks during guessing
  if(gameState.room!.state.guessingActive) {
    let map = e.target;

    // remove any existing markers previous guesses
    removeAllMapMarkers();

    // add new marker to map
    let newMarker = L.marker(e.latlng, {
      icon: L.divIcon({
        className: `pin pin-${gameState.room!.state.players.get(gameState.room!.sessionId).color} pin-user`,
        iconSize: [30, 44],
        iconAnchor: [15, 44],
        html: `<span>${gameState.room!.state.players.get(gameState.room!.sessionId).name.slice(0, 1).toUpperCase()}</span>`
      })
    });
    gameState.currentMapMarkers.push(newMarker);
    newMarker.addTo(map);

    // send message to server
    gameState.room!.send("guess/submit", { latLng: e.latlng });
  }
}

function removeAllMapMarkers() {
  if(gameState.currentMapMarkers.length > 0) {
    gameState.currentMapMarkers.forEach((m) => {
      gameState.map!.removeLayer(m);
    })
    // clear current makers
    gameState.currentMapMarkers.splice(0, gameState.currentMapMarkers.length);
  }
}

function currentUserIsAdmin() {
  return gameState.room!.state.players.get(gameState.room!.sessionId).admin;
}

function currentUserIsInGame() {
  return gameState.room!.state.players.get(gameState.room!.sessionId).inGame;
}

function renderScores() {
  let scoresRows = "";

  let players = JSON.parse(JSON.stringify(gameState.room!.state.players));
  let playersSorted = Object.values(players).sort((a:any, b:any) => (a.score < b.score) ? 1 : -1)

  playersSorted.forEach((player: any) => {
    scoresRows += `\
        <tr>\
            <td>${player.name} ${player.lastDistance !== undefined ? `<span class="badge bg-secondary">${Math.floor(player.lastDistance).toLocaleString(window.navigator.language)} km</span>` : ''}</td>\
            <td>${player.lastScore !== undefined ? `+${player.lastScore.toLocaleString(window.navigator.language)}` : ''}</td>\
            <td class="text-end fw-bold">${player.score.toLocaleString(window.navigator.language)}</td>\
        </tr>`;
  });

  $('.scores tbody').html(scoresRows);
}

export function gatherSettingsData() {
  let inputRounds = $('#settings-rounds').val();

  if(inputRounds === undefined || inputRounds < 1 || inputRounds > 20) {
    inputRounds = 1;
  }

  return {
    rounds: inputRounds
  };
}

function wrapClosestToTarget(target: LatLng, pointToWrap: LatLng): LatLng {
  let maxLng = target.lng + 180;
  let minLng = target.lng - 180;
  let maxLat = 90;
  let minLat = -90;
  let dLng = maxLng - minLng;
  let dLat = maxLat - minLat;

  let lng = pointToWrap.lng === maxLng ? pointToWrap.lng : ((pointToWrap.lng - minLng) % dLng + dLng) % dLng + minLng;
  let lat = pointToWrap.lat === maxLat ? pointToWrap.lat : ((pointToWrap.lat - minLat) % dLat + dLat) % dLat + minLat;

  return new LatLng(lat, lng);
}
