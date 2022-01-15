import * as Colyseus from "colyseus.js";
import * as L from "leaflet";

export class GameState {
  client: Colyseus.Client;
  room: Colyseus.Room | undefined;
  map: L.Map | undefined;
  currentMapMarkers = new Array<any>();

  constructor(client: Colyseus.Client) {
    this.client = client;
  }
}
