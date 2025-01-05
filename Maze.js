import { readFile } from "fs/promises";
import readline from "readline";

// Pozastavení a potvrzení od uživatele o změně okna konzole
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
    console.log(finish)

    if (!start || !finish) {
        throw new Error("Bludišti chybí start S nebo cíl F")
    }
    return { start, finish }
}

// Mapa v konzoli
class MazeRenderMap {
    constructor(maze) {
        this.originalMaze = maze.map(row => [...row]);
        this.currentMaze = maze.map(row => [...row]); // Uchovává aktuální stav mapy
    }

    resetToOriginal() {
        this.currentMaze = this.originalMaze.map(row => [...row]);
    }

    setSymbol(x, y, symbol) {
        if (this.currentMaze[y][x] !== "#") {
            this.currentMaze[y][x] = symbol;
        }
    }

    printMaze() {
        console.clear();
        this.currentMaze.forEach(row => console.log(row.join("")));
    }

    updatePosition(oldPos, newPos, symbol) {
        // Pokud je stará pozice definovaná, vymaže ji
        if (oldPos) {
            process.stdout.write(`\x1b[${oldPos.y + 1};${oldPos.x + 1}H `); // Vymaže starý symbol
        }
        // Přidá nový symbol na novou pozici
        if (newPos) {
            process.stdout.write(`\x1b[${newPos.y + 1};${newPos.x + 1}H${symbol}`);
        }
        process.stdout.write("\x1b[0;0H"); // Reset kurzoru
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

// ------------------ STRATEGIES ------------------

// Wall-following algoritmus(Hand On Wall Rule) pro L/R trpaslíky
class WallFollowStrategy {
    constructor(wallSide) {
        this.wallSide = wallSide;
        this.currentDirection = { dx: 0, dy: 1 }; // Defaultní směr: dolů
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

        const newX = position.x + this.currentDirection.dx;
        const newY = position.y + this.currentDirection.dy;

        if (this.canMove(this.currentDirection, position, maze)) {
            return { x: newX, y: newY };
        }

        // Pokud nelze pohnout, zůstává na místě
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
        return { dx: direction.dy, dy: -direction.dx };
    }

    rotateRight(direction) {
        return { dx: -direction.dy, dy: direction.dx };
    }
}

// Trpaslík teleportující se náhodně po mapě
class RandomPortStrategy {
    constructor(maze,) {
        this.maze = maze;
        this.lastPosition = null;
    }

    move(position) {
        const emptyPositions = this.findEmptyPositions(this.maze);

        // Check Pokud nenajde cíl a zpotřebuje všechny volné pozice
        if (emptyPositions.length === 0) {
            console.error("Nebyla nalezena žádná volná pozice pro teleportaci.");
            return position;
        }

        let newPosition;
        let tries = 0;

        // Losuj, dokud se netrefíme do jiné pozice, než byla ta naposledy
        do {
            const randomIndex = Math.floor(Math.random() * emptyPositions.length);
            newPosition = emptyPositions[randomIndex];
            tries++;
        } while (
            this.lastPosition &&
            newPosition.x === this.lastPosition.x &&
            newPosition.y === this.lastPosition.y &&
            tries < emptyPositions.length * 2
        );


        this.lastPosition = newPosition;

        // Výsledkem je nová pozice
        return { x: newPosition.x, y: newPosition.y };

    }

    findEmptyPositions(maze) {
        const emptyPositions = [];
        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[y].length; x++) {
                if (maze[y][x] !== "#") {
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
        this.path = this.findPath(maze, start, finish);
        this.currentStep = 0;
    }

    findPath(maze, start, finish) {
        const directions = [
            { dx: 0, dy: -1 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 0 },
        ];

        const visited = Array.from({ length: maze.length }, () =>
            Array(maze[0].length).fill(false)
        );
        const queue = [[{ x: start.x, y: start.y }]];

        visited[start.y][start.x] = true;

        while (queue.length > 0) {
            const path = queue.shift();
            const { x, y } = path[path.length - 1];

            if (x === finish.x && y === finish.y) {
                return path;
            }

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
            return this.path[this.currentStep++];
        }
        return position;
    }
}

// Factory
class DwarfFactory {

    static createDwarf(type, maze, start, finish) {
        switch (type) {
            case "leftWall":
                return new Dwarf(maze, start, finish, new WallFollowStrategy("left"));
            case "rightWall":
                return new Dwarf(maze, start, finish, new WallFollowStrategy("right"));
            case "randomPort":
                return new Dwarf(maze, start, finish, new RandomPortStrategy(maze, 100));
            case "pathFollow":
                return new Dwarf(maze, start, finish, new PathFollowingStrategy(maze, start, finish));
            default:
                throw new Error(`Neznámý typ trpaslíka: ${type}`);
        }
    }
}

// Simulace 
async function simulateDwarfs(maze, start, finish) {
    const renderer = new MazeRenderMap(maze);

    const dwarfsConfig = [
        { type: "leftWall", name: "LeftTurnDwarf", symbol: "L" },
        { type: "rightWall", name: "RightTurnDwarf", symbol: "R" },
        { type: "pathFollow", name: "PathFollowerDwarf", symbol: "P" },
        { type: "randomPort", name: "RandomPortDwarf", symbol: "T" }
    ];

    const dwarfs = dwarfsConfig.map((cfg, i) => ({
        dwarf: DwarfFactory.createDwarf(cfg.type, maze, start, finish),
        name: cfg.name,
        symbol: cfg.symbol,
        startDelay: i * 5000,
        active: false,
        lastPosition: null // Pro sledování předchozí pozice
    }));

    console.clear();
    renderer.printMaze();

    const simulationStartTime = Date.now();
    let allFinished = false;

    while (!allFinished) {
        const now = Date.now();
        const elapsed = now - simulationStartTime;

        // Aktivace trpaslíků
        dwarfs.forEach((dw) => {
            if (!dw.active && elapsed >= dw.startDelay) {
                dw.active = true;
            }
        });

        // Posun aktivních trpaslíků
        dwarfs.forEach(dw => {
            if (dw.active && !dw.dwarf.isAtFinish()) {
                const oldPos = { ...dw.dwarf.position }; // Uchová starou pozici
                dw.dwarf.position = dw.dwarf.strategy.move(dw.dwarf.position, maze);
                const newPos = dw.dwarf.position;

                // Aktualizace na obrazovce pouze pokud se pozice změnila
                if (newPos.x !== oldPos.x || newPos.y !== oldPos.y) {
                    renderer.updatePosition(oldPos, newPos, dw.symbol);
                }
                dw.lastPosition = { ...newPos }; // Uložení nové pozice
            }
        });

        // Přesunutí kurzoru pod mapu a vyčištění oblasti pro logy
        process.stdout.write(`\x1b[${maze.length + 1};1H`); // Přesuň kurzor pod mapu
        console.log("\x1b[0J"); // Vymaže vše pod kurzorem

        // Logování stavu trpaslíků
        console.log("Aktuální pozice trpaslíků:");
        dwarfs.forEach(dw => {
            const { x, y } = dw.dwarf.position;
            if (!dw.active) {
                console.log(` - ${dw.name}: (Ještě neodstartoval)`);
            } else if (dw.dwarf.isAtFinish()) {
                console.log(` - ${dw.name}: (${x}, ${y}) - Dorazil do cíle!`);
            } else {
                console.log(` - ${dw.name}: (${x}, ${y})`);
            }
        });

        // Kontrola dokončení
        allFinished = dwarfs.every(dw => dw.dwarf.isAtFinish());

        // Pauza mezi iteracemi
        if (!allFinished) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log("\nVšichni trpaslíci úspěšně došli do cíle!");
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

        // Vypočítání minimální šířky a výšky konzole
        const minWidth = maze[0].length + 10;
        const minHeight = maze.length + 5;

        // Kontrola velikosti konzole a případné čekání
        await ensureConsoleSize(minWidth, minHeight);

        // Spuštění simulace
        await simulateDwarfs(maze, start, finish);
    } catch (err) {
        console.error(`Chyba: ${err.message}`);
    }
}

main();
