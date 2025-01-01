using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

class Program
{   // Pozastavení a potvrzení od uživatele o změně okna konzole
    static async Task PauseUntilKeyPress(string message)
    {
        Console.WriteLine(message);
        Console.WriteLine("Stiskněte Enter pro pokračování...");
        await Task.Run(() => Console.ReadLine());
    }

    // Kontrola velikosti konzole
    static void EnsureConsoleSize(int minWidth, int minHeight)
    { 
        while (Console.WindowWidth < minWidth || Console.WindowHeight < minHeight)
        {
            Console.Clear();
            Console.WriteLine("\n===========================");
            Console.WriteLine("Konzole je příliš malá!");
            Console.WriteLine("===========================\n");
            Console.WriteLine($"Požadovaná velikost:\n  - Šířka: {minWidth}\n  - Výška: {minHeight}\n");
            Console.WriteLine("Aktuální velikost konzole:");
            Console.WriteLine($"  - Šířka: {Console.WindowWidth}\n  - Výška: {Console.WindowHeight}\n");
            Console.WriteLine("\n===========================\n");
            PauseUntilKeyPress("Změňte velikost okna konzole a poté potvrďte pokračování.").Wait();
        }
    }
    
    // Načtení souboru
    static string[][] ReadMazeFile(string filePath)
    {
        try
        {
            var lines = File.ReadAllLines(filePath);
            return lines.Select(line => line.Trim().Select(ch => ch.ToString()).ToArray()).ToArray();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Chyba při čtení souboru: {ex.Message}");
            throw;
        }
    }

    // Kontrola dat v souboru - počet char v řádku
    static void ValidateMaze(string[][] maze)
    {
        int rowLength = maze[0].Length;
        for (int i = 0; i < maze.Length; i++)
        {
            if (maze[i].Length != rowLength)
            {
                Console.WriteLine($"Chyba na řádku {i + 1}: Očekáváno {rowLength} znaků, ale nalezeno {maze[i].Length}.");
                throw new Exception("Bludiště má řádky s různou délkou.");
            }
        }
    }

    // Nastavení startu S a cíle F
    static (Point start, Point finish) FindStartAndFinish(string[][] maze)
    {
        Point start = null;
        Point finish = null;

        for (int y = 0; y < maze.Length; y++)
        {
            for (int x = 0; x < maze[y].Length; x++)
            {
                if (maze[y][x] == "S")
                {
                    start = new Point(x, y);
                }
                if (maze[y][x] == "F")
                {
                    finish = new Point(x, y);
                }
            }
        }

        if (start == null || finish == null)
        {
            throw new Exception("Bludišti chybí start S nebo cíl F");
        }

        return (start, finish);
    }

    // Bod v 2d prostoru
    class Point
    {
        public int X { get; set; }
        public int Y { get; set; }

        public Point(int x, int y)
        {
            X = x;
            Y = y;
        }
    }
    // Mapa v konzoli
    class MazeRenderer
    {
        private string[][] originalMaze;
        private string[][] maze;

        public MazeRenderer(string[][] maze)
        {
            originalMaze = maze.Select(row => row.ToArray()).ToArray();
            this.maze = maze.Select(row => row.ToArray()).ToArray();
        }

        public void ResetToOriginal()
        {
            maze = originalMaze.Select(row => row.ToArray()).ToArray();
        }

        public void SetSymbol(int x, int y, string symbol)
        {
            if (maze[y][x] != "#")
            {
                maze[y][x] = symbol;
            }
        }

        public void PrintMaze()
        {
            Console.Clear();
            foreach (var row in maze)
            {
                Console.WriteLine(string.Join("", row));
            }
        }
    }
    // Trpaslík
    class Dwarf
    {
        public Point Position { get; private set; }
        private Point finish;
        private IMoveStrategy strategy;

        public Dwarf(Point start, Point finish, IMoveStrategy strategy)
        {
            Position = new Point(start.X, start.Y);
            this.finish = finish;
            this.strategy = strategy;
        }

        public bool IsAtFinish()
        {
            return Position.X == finish.X && Position.Y == finish.Y;
        }

        public void Move(string[][] maze)
        {
            Position = strategy.Move(Position, maze);
        }
    }

    // Pohyb
    interface IMoveStrategy
    {
        Point Move(Point position, string[][] maze);
    }

    // Wall-following algoritmus pro L/R trpaslíky
    class WallFollowStrategy : IMoveStrategy
    {
        private string wallSide;
        private (int dx, int dy) currentDirection = (0, 1);

        public WallFollowStrategy(string wallSide)
        {
            this.wallSide = wallSide;
        }

        public Point Move(Point position, string[][] maze)
        {
            var wallDirection = wallSide == "left" ? RotateLeft(currentDirection) : RotateRight(currentDirection);

            if (CanMove(wallDirection, position, maze))
            {
                currentDirection = wallDirection;
            }
            else if (CanMove(currentDirection, position, maze))
            {
                // Směr vpřed je možný
            }
            else
            {
                currentDirection = wallSide == "left" ? RotateRight(currentDirection) : RotateLeft(currentDirection);
            }

            var newX = position.X + currentDirection.dx;
            var newY = position.Y + currentDirection.dy;

            if (CanMove(currentDirection, position, maze))
            {
                return new Point(newX, newY);
            }

            return position;
        }

        private bool CanMove((int dx, int dy) direction, Point position, string[][] maze)
        {
            var newX = position.X + direction.dx;
            var newY = position.Y + direction.dy;
            return newX >= 0 && newY >= 0 && newX < maze[0].Length && newY < maze.Length && maze[newY][newX] != "#";
        }

        private (int dx, int dy) RotateLeft((int dx, int dy) direction)
        {
            return (-direction.dy, direction.dx);
        }

        private (int dx, int dy) RotateRight((int dx, int dy) direction)
        {
            return (direction.dy, -direction.dx);
        }
    }

    // Trpaslík teleportující se náhodně po mapě
    class RandomPortStrategy : IMoveStrategy
    {
        private string[][] maze;
        private Point lastPosition;

        public RandomPortStrategy(string[][] maze)
        {
            this.maze = maze;
        }

        public Point Move(Point position, string[][] maze)
        {
            var emptyPositions = FindEmptyPositions(maze);

            if (emptyPositions.Count == 0)
            {
                Console.WriteLine("Nebyla nalezena žádná volná pozice pro teleportaci.");
                return position;
            }

            Point newPosition;
            int tries = 0;

            do
            {
                var randomIndex = new Random().Next(emptyPositions.Count);
                newPosition = emptyPositions[randomIndex];
                tries++;
            } while (lastPosition != null && newPosition.X == lastPosition.X && newPosition.Y == lastPosition.Y && tries < emptyPositions.Count * 2);

            lastPosition = newPosition;
            return newPosition;
        }

        private List<Point> FindEmptyPositions(string[][] maze)
        {
            var emptyPositions = new List<Point>();
            for (int y = 0; y < maze.Length; y++)
            {
                for (int x = 0; x < maze[y].Length; x++)
                {
                    if (maze[y][x] != "#")
                    {
                        emptyPositions.Add(new Point(x, y));
                    }
                }
            }
            return emptyPositions;
        }
    }

    // Trpaslík následující nalezenou cestu BFS
    class PathFollowingStrategy : IMoveStrategy
    {
        private List<Point> path;
        private int currentStep;

        public PathFollowingStrategy(string[][] maze, Point start, Point finish)
        {
            path = FindPath(maze, start, finish);
            currentStep = 0;
        }

        public Point Move(Point position, string[][] maze)
        {
            if (currentStep < path.Count)
            {
                return path[currentStep++];
            }
            return position;
        }

        private List<Point> FindPath(string[][] maze, Point start, Point finish)
        {
            var directions = new List<(int dx, int dy)>
            {
                (0, -1), (-1, 0), (0, 1), (1, 0)
            };

            var visited = new bool[maze.Length, maze[0].Length];
            var queue = new Queue<List<Point>>();
            queue.Enqueue(new List<Point> { start });

            visited[start.Y, start.X] = true;

            while (queue.Count > 0)
            {
                var path = queue.Dequeue();
                var lastPoint = path.Last();

                if (lastPoint.X == finish.X && lastPoint.Y == finish.Y)
                {
                    return path;
                }

                foreach (var (dx, dy) in directions)
                {
                    var newX = lastPoint.X + dx;
                    var newY = lastPoint.Y + dy;

                    if (newX >= 0 && newY >= 0 && newX < maze[0].Length && newY < maze.Length && maze[newY][newX] != "#" && !visited[newY, newX])
                    {
                        visited[newY, newX] = true;
                        var newPath = new List<Point>(path) { new Point(newX, newY) };
                        queue.Enqueue(newPath);
                    }
                }
            }

            throw new Exception("Cesta nenalezena.");
        }
    }

    // Factory
    class DwarfFactory
    {
        public static Dwarf CreateDwarf(string type, string[][] maze, Point start, Point finish)
        {
            switch (type.ToLower())
            {
                case "leftwall":
                    return new Dwarf(start, finish, new WallFollowStrategy("left"));
                case "rightwall":
                    return new Dwarf(start, finish, new WallFollowStrategy("right"));
                case "randomport":
                    return new Dwarf(start, finish, new RandomPortStrategy(maze));
                case "pathfollow":
                    return new Dwarf(start, finish, new PathFollowingStrategy(maze, start, finish));
                default:
                    throw new ArgumentException($"Neznámý typ trpaslíka: {type}");
            }
        }
    }

    // Simulace 
    async Task SimulateDwarfs(string[][] maze, Point start, Point finish)
    {
        MazeRenderer renderer = new MazeRenderer(maze);

        // Konfigurace trpaslíků
        var dwarfsConfig = new List<(string Type, string Name, char Symbol, int StartDelay)>
        {
            ("leftwall", "LeftTurnDwarf", 'L', 0),
            ("rightwall", "RightTurnDwarf", 'R', 5000),
            ("pathfollow", "PathFollowerDwarf", 'P', 10000),
            ("randomport", "RandomPortDwarf", 'T', 15000)
        };

        // Vytvoření trpaslíků
        var dwarfs = dwarfsConfig.Select(config => new
        {
            Dwarf = DwarfFactory.CreateDwarf(config.Type, maze, start, finish),
            config.Name,
            config.Symbol,
            config.StartDelay,
            Active = false
        }).ToList();

        // Uložení předchozích pozic trpaslíků
        var previousPositions = dwarfs.Select(dw => new Point(dw.Dwarf.Position.X, dw.Dwarf.Position.Y)).ToList();

        DateTime simulationStartTime = DateTime.Now;
        bool allFinished = false;

        renderer.ResetToOriginal();
        renderer.PrintMaze();

        while (!allFinished)
        {
            TimeSpan elapsed = DateTime.Now - simulationStartTime;

            // Aktivace trpaslíků na základě jejich StartDelay
            foreach (var dwarf in dwarfs)
            {
                if (!dwarf.Active && elapsed.TotalMilliseconds >= dwarf.StartDelay)
                {
                    dwarf.Active = true;
                }
            }

            // Pohyb aktivních trpaslíků
            foreach (var dwarf in dwarfs)
            {
                if (dwarf.Active && !dwarf.Dwarf.IsAtFinish())
                {
                    dwarf.Dwarf.Move(maze);
                }
            }

            // Kontrola, zda se některý trpaslík pohnul
            bool positionsChanged = false;
            for (int i = 0; i < dwarfs.Count; i++)
            {
                var oldPos = previousPositions[i];
                var newPos = dwarfs[i].Dwarf.Position;
                if (oldPos.X != newPos.X || oldPos.Y != newPos.Y)
                {
                    positionsChanged = true;
                }
            }

            // Překreslení mapy, pokud se něco změnilo
            if (positionsChanged)
            {
                renderer.ResetToOriginal();
                foreach (var dwarf in dwarfs)
                {
                    if (dwarf.Active && !dwarf.Dwarf.IsAtFinish())
                    {
                        renderer.SetSymbol(dwarf.Dwarf.Position.X, dwarf.Dwarf.Position.Y, dwarf.Symbol.ToString());
                    }
                }
                renderer.PrintMaze();

                // Výpis aktuálních stavů
                Console.WriteLine("Aktuální pozice trpaslíků:");
                foreach (var dwarf in dwarfs)
                {
                    if (!dwarf.Active)
                    {
                        Console.WriteLine($" - {dwarf.Name}: (Ještě neodstartoval)");
                    }
                    else if (dwarf.Dwarf.IsAtFinish())
                    {
                        Console.WriteLine($" - {dwarf.Name}: ({dwarf.Dwarf.Position.X}, {dwarf.Dwarf.Position.Y}) - Dorazil do cíle!");
                    }
                    else
                    {
                        Console.WriteLine($" - {dwarf.Name}: ({dwarf.Dwarf.Position.X}, {dwarf.Dwarf.Position.Y})");
                    }
                }
            }

            // Uložení aktuálních pozic
            previousPositions = dwarfs.Select(dw => new Point(dw.Dwarf.Position.X, dw.Dwarf.Position.Y)).ToList();

            // Kontrola, zda všichni došli do cíle
            allFinished = dwarfs.All(dw => dw.Dwarf.IsAtFinish());

            // Pauza mezi iteracemi
            if (!allFinished)
            {
                await Task.Delay(100);
            }
        }

        Console.WriteLine("Všichni trpaslíci úspěšně došli do cíle!");
    }

    // Hlavní funkce
    static async Task Main(string[] args)
    {
        try
        {
            string filePath = "Maze.dat";
            string[][] maze = ReadMazeFile(filePath);
            ValidateMaze(maze);

            var (start, finish) = FindStartAndFinish(maze);

            int minWidth = maze[0].Length + 10;
            int minHeight = maze.Length + 5;

            EnsureConsoleSize(minWidth, minHeight);

            var renderer = new MazeRenderer(maze);

            // Simulace trpaslíků a strategie budou přidány zde
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Chyba: {ex.Message}");
        }
    }
}
