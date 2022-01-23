# Haystack Client

This is a simple client/frontend implementation of Haystack, a multiplayer 
geography quiz game. It is implemented in TypeScript with jQuery.

Communication with the backend is realized with 
[colyseus.js](https://docs.colyseus.io/colyseus/getting-started/javascript-client/) via Websockets.

The map view is realized with [Leaflet](https://github.com/Leaflet/Leaflet).

A running version of the game can be found at [haystack.axm.li](https://haystack.axm.li/).

For rules and features of the game, see 
[haystack-server](https://github.com/alex2702/haystack-server#game-logic-and-features).

## Screenshots

![Lobby](/screenshot_lobby.png "Lobby")
![Solution of a Round](/screenshot_result.png "Solution of a Round")

## Running the Project

```
npm install
npm start
```

## Project Structure

- `index.html` contains all the markup.
- `css` contains basic stylesheets from [html5-boilerplate](https://github.com/h5bp/html5-boilerplate) and some custom styles.
- `js` contains boilerplate JavaScript code.
- `scss` contains the Bootstrap config.
- `ts` contains the TypeScript implementation of the client-side game logic.
- `package.json`:
    - `scripts`:
        - `npm dev`: runs `parcel index.html --open`
        - `npm start`: runs `npm run build && npm run dev`
- `tsconfig.json`: TypeScript configuration file

## License

MIT
