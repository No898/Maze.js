import { readFile } from "fs/promises";
import readline from "readline";


// Pozastavení a potvrzení od uživatele o změně okna
function pauseUntilKeyPress(message) {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(`${message}\nStiskněte Enter pro pokračování...`, () => {
            rl.close();
            resolve();
        });
    });
}

// Kontrola velikosti konzole
async function ensureConsoleSize(minWidth, minHeight) {
    const { columns, rows } = process.stdout;

    if (columns < minWidth || rows < minHeight) {
        console.log("\n===========================");
        console.log("Konzole je příliš malá!");
        console.log("===========================\n");
        console.log(`Požadovaná velikost:`);
        console.log(`  - Šířka: ${minWidth}`);
        console.log(`  - Výška: ${minHeight}`);
        console.log("\nAktuální velikost konzole:");
        console.log(`  - Šířka: ${columns}`);
        console.log(`  - Výška: ${rows}`);
        console.log("\n===========================\n");
        await pauseUntilKeyPress(
            "Změňte velikost okna konzole a poté potvrďte pokračování.",
        );
        return ensureConsoleSize(minWidth, minHeight);
    }
}

// Načtení souboru
async function readMazeFile(filePath) {
    try {
        const data = await readFile(filePath, "utf8");
        return data.trim().split("\n").map(row => row.trim().split(""));
    } catch (err) {
        console.error(`Chyba při čtení souboru: ${err.message}`);
        throw err;
    }
}

// Kontrola dat v souboru - počet char v řádku
function validateMaze(maze) {
    const rowLength = maze[0].length;
    const isValid = maze.every(row => row.length === rowLength);

    if (!isValid) {
        maze.forEach((row, index) => {
            if (row.length !== rowLength) {
                console.error(`Chyba na řádku ${index + 1}: Očekáváno ${rowLength} znaků, ale nalezeno ${row.length}.`);
            }
        });
        throw new Error("Bludiště má řádky s různou délkou.");
    }

    return rowLength;
}

// Nastavení startu S a cíle F
function findStartAndFinish(maze) {
    let start = null;
    let finish = null;

    maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === "S") start = { x, y }
            if (cell === "F") finish = { x, y }
        });
    })

    if (!start || !finish) {
        throw new Error("Bludišti chybí start S nebo cíl F")
    }
    return { start, finish }
}
// Mapa v konzoli
class MazeRenderMap {
    constructor(maze) {
        this.originalMaze = maze.map(row => [...row])
        this.maze = maze.map(row => [...row])
    }
    render(position, previousPosition, symbol, atFinish = false) {
        if (previousPosition) {
            const { x, y } = previousPosition;
            if (this.maze[y][x] !== "#") {
                this.maze[y][x] = " ";
            }
        }

        if (!atFinish) { // Symbol trpaslíka přidáme pouze, pokud nedorazil do cíle
            const { x, y } = position;
            if (this.maze[y][x] !== "#") {
                this.maze[y][x] = symbol;
            }
        }

        console.clear();
        this.maze.forEach(row => console.log(row.join("")));
    }

}
// Trpaslík
class Dwarf {
    constructor(maze, start, finish, strategy) {
        this.maze = maze;
        this.position = { ...start };
        this.finish = finish;
        this.strategy = strategy;
    }

    logPosition(name, dwarfPositions) {
        if (this.isAtFinish()) {
            dwarfPositions[name] = `(${this.position.x}, ${this.position.y}) - Dorazil do cíle!`;
        } else {
            dwarfPositions[name] = `(${this.position.x}, ${this.position.y})`;
        }
        console.log("Aktuální pozice trpaslíků:");
        for (const [dwarfName, pos] of Object.entries(dwarfPositions)) {
            console.log(` - ${dwarfName}: ${pos}`);
        }
    }


    isAtFinish() {
        return this.position.x === this.finish.x && this.position.y === this.finish.y;
    }
}


// Wall-following algoritmus pro L/R trpaslíky
class WallFollowStrategy {
    constructor(wallSide) {
        this.wallSide = wallSide;
        this.currentDirection = { dx: 0, dy: 1 }; // Defaultní směr dolů
    }

    move(position, maze) {
        const wallDirection = this.wallSide === "left"
            ? this.rotateLeft(this.currentDirection)
            : this.rotateRight(this.currentDirection);

        if (this.canMove(wallDirection, position, maze)) {
            this.currentDirection = wallDirection;
        } else if (this.canMove(this.currentDirection, position, maze)) {
            // Směr vpřed je možný
        } else {
            this.currentDirection = this.wallSide === "left"
                ? this.rotateRight(this.currentDirection)
                : this.rotateLeft(this.currentDirection);
        }

        // Kontrola, zda je pohyb možný
        const newX = position.x + this.currentDirection.dx;
        const newY = position.y + this.currentDirection.dy;

        if (this.canMove(this.currentDirection, position, maze)) {
            return { x: newX, y: newY };
        }

        // Pokud pohyb není možný, zůstává na místě
        return position;
    }

    canMove(direction, position, maze) {
        const newX = position.x + direction.dx;
        const newY = position.y + direction.dy;
        return (
            newX >= 0 &&
            newY >= 0 &&
            newX < maze[0].length &&
            newY < maze.length &&
            maze[newY][newX] !== "#"
        );
    }

    rotateLeft(direction) {
        return { dx: -direction.dy, dy: direction.dx };
    }

    rotateRight(direction) {
        return { dx: direction.dy, dy: -direction.dx };
    }
}

// Trpaslík teleportující se náhodně po mapě
class RandomPortStrategy {
    constructor(maze, teleportInterval = 5000) {
        this.maze = maze;
        this.teleportInterval = teleportInterval; // Interval teleportace v ms
        this.lastTeleportTime = Date.now(); // Čas poslední teleportace
    }

    move(position) {
        const currentTime = Date.now();

        // Zkontrolujeme, zda je čas pro teleportaci
        if (currentTime - this.lastTeleportTime >= this.teleportInterval) {
            const emptyPositions = this.findEmptyPositions(this.maze);

            if (emptyPositions.length === 0) {
                console.error("Nebyla nalezena žádná volná pozice pro teleportaci.");
                return position; // Pokud nejsou volné pozice, zůstává na místě
            }

            // Vybereme náhodnou volnou pozici (včetně cíle F)
            const randomIndex = Math.floor(Math.random() * emptyPositions.length);
            const newPosition = emptyPositions[randomIndex];

            // Aktualizujeme čas poslední teleportace
            this.lastTeleportTime = currentTime;

            console.log(`Trpaslík se teleportoval na pozici: (${newPosition.x}, ${newPosition.y})`);
            return { x: newPosition.x, y: newPosition.y };
        }

        // Pokud není čas na teleportaci, zůstává na aktuální pozici
        console.log(`Trpaslík čeká na další teleportaci. Pozice: (${position.x}, ${position.y})`);
        return position;
    }

    // Najde všechny volné pozice v bludišti (včetně cíle F)
    findEmptyPositions(maze) {
        const emptyPositions = [];
        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[y].length; x++) {
                if (maze[y][x] !== "#") { // Překážky vyloučeny, ale F a S jsou povoleny
                    emptyPositions.push({ x, y });
                }
            }
        }
        return emptyPositions;
    }
}

// Trpaslík následující nalezenou cestu BFS
class PathFollowingStrategy {
    constructor(maze, start, finish) {
        this.path = this.findPath(maze, start, finish); // Najdeme cestu při inicializaci
        this.currentStep = 0;
    }

    findPath(maze, start, finish) {
        const directions = [
            { dx: 0, dy: -1 }, // nahoru
            { dx: -1, dy: 0 }, // doleva
            { dx: 0, dy: 1 }, // dolů
            { dx: 1, dy: 0 }, // doprava
        ];

        const visited = Array.from({ length: maze.length }, () =>
            Array(maze[0].length).fill(false)
        );
        const queue = [[{ x: start.x, y: start.y }]];

        visited[start.y][start.x] = true;

        while (queue.length > 0) {
            const path = queue.shift();
            const { x, y } = path[path.length - 1];

            // Našli jsme cíl
            if (x === finish.x && y === finish.y) {
                return path;
            }

            // Průzkum všech směrů
            for (const { dx, dy } of directions) {
                const newX = x + dx;
                const newY = y + dy;

                if (
                    newX >= 0 &&
                    newY >= 0 &&
                    newX < maze[0].length &&
                    newY < maze.length &&
                    maze[newY][newX] !== "#" &&
                    !visited[newY][newX]
                ) {
                    visited[newY][newX] = true;
                    queue.push([...path, { x: newX, y: newY }]);
                }
            }
        }

        throw new Error("Cesta nenalezena.");
    }

    move(position, maze) {
        if (this.currentStep < this.path.length) {
            return this.path[this.currentStep++]; // Posun na další pozici v cestě
        }
        return position; // Pokud jsme dosáhli cíle, zůstává na místě
    }
}

// Simulace 
async function simulateDwarfs(maze, start, finish) {
    const renderer = new MazeRenderMap(maze);

    const leftWallStrategy = new WallFollowStrategy("left");
    const rightWallStrategy = new WallFollowStrategy("right");
    const pathFollowingStrategy = new PathFollowingStrategy(maze, start, finish);
    const randomPortStrategy = new RandomPortStrategy(maze, 100);

    const dwarfs = [
        { dwarf: new Dwarf(maze, start, finish, leftWallStrategy), name: "LeftTurnDwarf", symbol: "L" },
        { dwarf: new Dwarf(maze, start, finish, rightWallStrategy), name: "RightTurnDwarf", symbol: "R" },
        { dwarf: new Dwarf(maze, start, finish, pathFollowingStrategy), name: "PathFollowerDwarf", symbol: "P" },
        { dwarf: new Dwarf(maze, start, finish, randomPortStrategy), name: "RandomPortDwarf", symbol: "T" }
    ];

    const dwarfPositions = {}; // Uchování pozic všech trpaslíků

    for (let i = 0; i < dwarfs.length; i++) {
        const { dwarf, name, symbol } = dwarfs[i];

        // Spusťte dalšího trpaslíka po 5s odstartování aktuálního
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pauza 5s
        }

        // Asynchronně spustit simulaci jednoho trpaslíka
        (async () => {
            let previousPosition = { ...dwarf.position };

            while (!dwarf.isAtFinish()) {
                // Render před pohybem
                renderer.render(dwarf.position, previousPosition, symbol);

                // Aktualizovat previousPosition před změnou pozice
                previousPosition = { ...dwarf.position };

                dwarf.position = dwarf.strategy
                    ? dwarf.strategy.move(dwarf.position, maze) // Strategie pro WallFollow trpaslíky
                    : dwarf.path[dwarf.currentStep++]; // Pohyb pro BFS trpaslíka

                // Aktualizace a zobrazení pozic
                dwarf.logPosition(name, dwarfPositions);

                await new Promise(resolve => setTimeout(resolve, 100)); // Pauza 100ms
            }

            // Po dosažení cíle odstraníme symbol z mapy
            renderer.render(dwarf.position, previousPosition, symbol, true);
            console.log(`Všichni trpaslíci úspěšně dosáhli cíle!`);
        })();
    }
}







// Hlavní funkce
async function main() {
    try {
        // Načtení bludiště
        const maze = await readMazeFile("Maze.dat");

        // Validace bludiště
        validateMaze(maze);

        // Nalezení startu a cíle
        const { start, finish } = findStartAndFinish(maze);

        // Vypočítání minimální šířky a výšky konzole na základě velikosti bludiště s extra prostorem
        const minWidth = maze[0].length + 10;
        const minHeight = maze.length + 5;

        // Zkontrolujte velikost konzole a případně počkejte na uživatelskou akci
        await ensureConsoleSize(minWidth, minHeight);

        // Spuštění simulace
        console.log("Simulace trpaslíků začíná...");
        await simulateDwarfs(maze, start, finish);
        console.log("Simulace dokončena.");
    } catch (err) {
        console.error(`Chyba: ${err.message}`);
    }
}

main();
