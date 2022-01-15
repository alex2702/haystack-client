import { Schema, MapSchema, Context, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string | undefined;
  @type("string") name: string | undefined;
  @type("string") color: string | undefined;
  @type("boolean") admin: boolean | undefined;
  @type("boolean") inGame: boolean = false;
  @type("number") score: number = 0;
  @type("boolean") roundDone: boolean = false;
  @type("number") lastGuessLat: number = 0;
  @type("number") lastGuessLng: number = 0;
  @type("number") lastDistance: number = 0;
  @type("number") lastScore: number = 0;

  @type("boolean") disconnectedPreviously = false;
  @type("boolean") disconnectedCurrently = false;

  @type("number") timeJoined: number = 0;
}
