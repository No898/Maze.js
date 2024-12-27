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
        console.log(
            `Konzole je příliš malá. Aktuální velikost: šířka = ${columns}, výška = ${rows}.`,
        );
        console.log(
            `Požadovaná minimální velikost: šířka = ${minWidth}, výška = ${minHeight}.`,
        );
        await pauseUntilKeyPress(
            "Změňte velikost okna konzole a poté potvrďte pokračování.",
        );
        return ensureConsoleSize(minWidth, minHeight); // Opětovná kontrola po potvrzení
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

    render(position, previusPosition, symbol) {
        if (previusPosition) {
            const { x, y } = previusPosition;
            if (this.maze[y][x] === "." || this.isSymbol(this.maze[y][x])) {
                this.maze[y][x] = symbol;
            }
        }

        const { x, y } = position
        this.maze[y][x] = symbol;

        console.clear();
        console.log("\n".repeat(process.stdout.rows - this.maze.length));
        this.maze.forEach(row => console.log(row.join("").padEnd(process.stdout.columns)));
    }
    isSymbol(cell) {
        // Kontroluje, zda je buňka již označena symbolem trpaslíka
        return ["L", "R", "T", "P"].includes(cell);
    }
}
// Trpaslík
class Dwarf {
    constructor(maze, start, finish) {
        this.maze = maze;
        this.position = { ...start };
        this.finish = finish;
        this.visited = new Set();
        this.visited.add(`${this.position.x},${this.position.y}`)
    }

    logPosition() {
        console.log(`Pozice trpaslíka: (${this.position.x}, ${this.position.y})`)
    }

    isAtFinish() {
        return this.position.x === this.finish.x && this.position.y === this.finish.y;
    }

}

// Trpaslík rotující doprava
class LeftTurnDwarf extends Dwarf {
    constructor(maze, start, finish) {
        super(maze, start, finish)
        this.directions = [
            { dx: 0, dy: -1 }, // nahoru
            { dx: -1, dy: 0 }, // doleva
            { dx: 0, dy: 1 }, // dolů
            { dx: 1, dy: 0 }, // doprava
        ]
        this.currentDirection = 0;
        this.stack = [] // Zásobník pro uložení cesty
        this.stack.push({ ...this.position })
    }

    move() {
        for (let i = 0; i < 4; i++) {
            const { dx, dy } = this.directions[this.currentDirection]
            const newX = this.position.x + dx;
            const newY = this.position.y + dy;

            if (this.isValidMove(newX, newY)) {
                this.stack.push({ ...this.position }); // Uložení pozice do zásobníku
                this.position = { x: newX, y: newY }; // Nová pozice
                this.visited.add(`${newX},${newY}`); // Označení nové pozice 
                this.logPosition();
                return;
            }

            this.currentDirection = (this.currentDirection + 3) % 4;
        }
        // Pokud nejsou validní pohyby, vratí se zpět
        if (this.stack.length > 0) {
            this.position = this.stack.pop();
            this.logPosition();
        } else {
            console.log("LeftTurnDwarf uvízl a nemůže se vrátit.");
        }
    }


    isValidMove(x, y) {
        return (
            x >= 0 &&
            y >= 0 &&
            x < this.maze[0].length &&
            y < this.maze.length &&
            this.maze[y][x] !== "#" &&
            !this.visited.has(`${x},${y}`)
        );

    };
}

// Trpaslík rotující doleva
class RightTurnDwarf extends Dwarf {
    constructor(maze, start, finish) {
        super(maze, start, finish);
        this.directions = [
            { dx: 0, dy: -1 }, // nahoru
            { dx: 1, dy: 0 },  // doprava
            { dx: 0, dy: 1 },  // dolů
            { dx: -1, dy: 0 }, // doleva
        ];
        this.currentDirection = 0;
        this.stack = []; // Zásobník pro uchování cesty
        this.stack.push({ ...this.position }); // Uložení startovní pozice
    }

    move() {
        for (let i = 0; i < 4; i++) {
            const { dx, dy } = this.directions[this.currentDirection];
            const newX = this.position.x + dx;
            const newY = this.position.y + dy;

            if (this.isValidMove(newX, newY)) {
                this.stack.push({ ...this.position }); // Uložení pozice do zásobníku
                this.position = { x: newX, y: newY }; // Nová pozice
                this.visited.add(`${newX},${newY}`); // Označení nové pozice
                this.logPosition();
                return;
            }

            this.currentDirection = (this.currentDirection + 1) % 4;
        }

        // Pokud nejsou validní pohyby, vrať se zpět
        if (this.stack.length > 0) {
            this.position = this.stack.pop();
            this.logPosition();
        } else {
            console.log("RighTurnDwarf trpaslík uvízl a nemůže se vrátit.");
        }
    }

    isValidMove(x, y) {
        return (
            x >= 0 &&
            y >= 0 &&
            x < this.maze[0].length &&
            y < this.maze.length &&
            this.maze[y][x] !== "#" &&
            !this.visited.has(`${x},${y}`)
        );
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
        const visited = new Set();
        visited.add(`${start.x},${start.y}`)

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
                    !visited.has(`${newX},${newY}`)
                ) {
                    visited.add(`${newX},${newY}`)
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
    const renderer = new MazeRenderMap(maze)

    const dwarfs = [
        { dwarf: new LeftTurnDwarf(maze, start, finish), name: "LeftTurnDwarf", symbol: "L" },
        { dwarf: new RightTurnDwarf(maze, start, finish), name: "RightTurnDwarf", symbol: "R" },
        { dwarf: new RandomPortDwarf(maze, start, finish), name: "RandomPortDwarf", symbol: "T" },
        { dwarf: new PathFollowingDwarf(maze, start, finish), name: "PathFollowingDwarf", symbol: "P" },
    ];

    for (const { dwarf, name, symbol } of dwarfs) {
        console.log(`Trpaslík ${name} přidán do bludiště...`);
        let previusPosition = null

        while (!dwarf.isAtFinish()) {
            renderer.render(dwarf.position, previusPosition, symbol)
            previusPosition = { ...dwarf.position }
            dwarf.move();
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
        console.log("Bludiště načteno.");

        // Validace bludiště
        validateMaze(maze);
        console.log("Bludiště je validní.");

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
