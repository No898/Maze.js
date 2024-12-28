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

    render(position, previousPosition, symbol) {
        if (previousPosition) {
            const { x, y } = previousPosition;
            if (this.maze[y][x]) {
                this.maze[y][x] = " ";
            }
        }

        const { x, y } = position;
        if (this.maze[y][x] !== "#") {
            this.maze[y][x] = symbol;
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

    logPosition() {
        console.log(`Pozice trpaslíka: (${this.position.x}, ${this.position.y})`)
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
        } else if (!this.canMove(this.currentDirection, position, maze)) {
            this.currentDirection = this.wallSide === "left"
                ? this.rotateRight(this.currentDirection)
                : this.rotateLeft(this.currentDirection);
        }

        return {
            x: position.x + this.currentDirection.dx,
            y: position.y + this.currentDirection.dy
        };
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


// Trpaslík spawnující se random po mapě
class RandomPortDwarf extends Dwarf {
    constructor(maze, start, finish) {
        super(maze, start, finish);
        this.teleported = false; // Indikátor, zda už se teleportoval
    }

    move() {
        if (!this.teleported && Math.random() < 0.1) { // 10% šance, pokud ještě neteleportoval
            this.position = { ...this.finish }; // Přesune se do cíle
            this.teleported = true; // Označí, že už se teleportoval
            console.log("Trpaslík se teleportoval do cíle!");
        } else if (!this.teleported) {
            console.log(`Trpaslík čeká na teleportaci. Pozice: (${this.position.x}, ${this.position.y})`);
        } else {
            console.log("Trpaslík už je v cíli a nepohybuje se.");
        }
    }
}

// Trpaslík následující nalezenou cestu
class PathFollowingDwarf extends Dwarf {
    constructor(maze, start, finish) {
        super(maze, start, finish);
        this.path = this.findPath(maze, start, finish);
        this.currentStep = 0;
    }

    findPath(maze, start, finish) {
        const directions = [
            { dx: 0, dy: -1 }, // nahoru
            { dx: -1, dy: 0 }, // doleva
            { dx: 0, dy: 1 }, // dolů
            { dx: 1, dy: 0 }, // doprava
        ]


        const queue = [[{ x: start.x, y: start.y }]]


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
                    maze[newY][newX] !== "#"
                ) {
                    queue.push([...path, { x: newX, y: newY }])
                }
            }
        }
        throw new Error("cesta nenalezena.")
    }
    move() {
        if (this.currentStep < this.path.length) {
            this.position = this.path[this.currentStep];
            this.logPosition();
            this.currentStep++;
        } else {
            console.log("Trpaslík už dosáhl cíle nebo dokončil cestu.");
        }
    }
}

// Simulace 
async function simulateDwarfs(maze, start, finish) {
    const renderer = new MazeRenderMap(maze);

    const leftWallStrategy = new WallFollowStrategy("left");
    const rightWallStrategy = new WallFollowStrategy("right");

    const dwarfs = [
        { dwarf: new Dwarf(maze, start, finish, leftWallStrategy), name: "LeftTurnDwarf", symbol: "L" },
        { dwarf: new Dwarf(maze, start, finish, rightWallStrategy), name: "RightTurnDwarf", symbol: "R" }
    ];

    for (const { dwarf, name, symbol } of dwarfs) {
        console.log(`Trpaslík ${name} přidán do bludiště...`);

        // Inicializace previousPosition
        let previousPosition = { ...dwarf.position };

        while (!dwarf.isAtFinish()) {
            // Render před pohybem
            renderer.render(dwarf.position, previousPosition, symbol);

            // Aktualizovat previousPosition před změnou pozice
            previousPosition = { ...dwarf.position };

            dwarf.position = dwarf.strategy.move(dwarf.position, maze);
            dwarf.logPosition();


            await new Promise(resolve => setTimeout(resolve, 100)); // Pauza 100ms
        }

        console.log(`Trpaslík ${name} dosáhl cíle!`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Pauza 5s mezi trpaslíky
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
