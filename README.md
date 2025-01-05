# Úkol - Projekt Trpaslík (Maze)

## Zadání

Vytvořte konzolovou aplikaci, která:

1. **Bludiště**
   - Načte bludiště definované v souboru `maze.dat` (viz příloha).
   - Bludiště se načte do paměti a vypíše na obrazovku (rozměr konzole se nastaví dle velikosti bludiště).
   - Značení:
     - `S` = Start
     - `F` = Cíl
     - `#` = Zeď

2. **Trpaslík**
   - Vytvořte objekt trpaslíka, který:
     - Se pohybuje bludištěm (pouze nahoru/dolu, vlevo/vpravo, nikoliv diagonálně).
     - Snaží se najít cestu ven.
       - Implementujte pomocí **Strategy** nebo **Polymorfismu**.

3. **Chování trpaslíků**
   - V bludišti postupně vložte 4 trpaslíky, každý po 5 sekundách:
     1. **Točí se doleva.**
     2. **Točí se doprava.**
     3. **Teleportuje se náhodně do cíle (Star Trek mód).**
     4. **Najde při vložení cestu k cíli a sleduje ji (algoritmus hledání cesty musí být dynamický, cesta nesmí být hard-coded, bludiště bude při testování změněno).**
   - Při každém kroku se vypíše aktuální pozice trpaslíka v bludišti (jedna iterace čeká 100 ms před dalším krokem).

4. **Dokončení**
   - Aplikace čeká, dokud všichni trpaslíci nedorazí do cíle.

## Požadavky
- **Platforma:** Javascript
- **Důraz na:**
  - Správné datové typy pro uložení bludiště.
  - Čistý kód.
  - Nepřekreslování bludiště, pokud to není nutné.
  - Správná implementace polymorfismu/Strategy vzoru, ideálně s využitím Factory pro trpaslíky.


## Řešení úkolu

### Načtení bludiště
- Bludiště se načítá ze souboru `Maze.dat`, který je validován, aby všechny řádky měly stejnou délku.
- Program automaticky detekuje polohy startu (`S`) a cíle (`F`).

### Kontrola velikosti konzole*
- Velikost konzole je ověřována před spuštěním simulace. Pokud není dostatečná, uživatel je vyzván ke změně velikosti.

### Implementované strategie
Čtyři různé strategie pohybu trpaslíků jsou realizovány pomocí polymorfismu:
1. **Točení doleva:** Trpaslík používá algoritmus „levé stěny“.
2. **Točení doprava:** Trpaslík používá algoritmus „pravé stěny“.
3. **Teleportace:** Trpaslík se náhodně teleportuje na volné pozice v bludišti.
4. **Sledování cesty:** Trpaslík si pomocí BFS najde nejkratší cestu a sleduje ji.

### Překreslování bludiště
- Překresluje se pouze pohyb trpaslíků, vypsané pozice trpaslíků, aby se minimalizovalo zbytečné překreslování.

### Simulace
- Trpaslíci jsou do bludiště vkládáni postupně s odstupem 5 sekund.
- Pohyb probíhá v iteracích, každá iterace trvá 100 ms.
- Simulace končí, když všichni trpaslíci dosáhnou cíle.

---

## Spuštění aplikace
1. Ujistěte se, že máte nainstalovaný **Node.js**. https://nodejs.org/
2. Umístěte soubor `maze.dat` do stejné složky jako aplikace.
3. Spusťte aplikaci příkazem:
   node Maze.js


### *Poznámka k velikosti konzole

Node.js ani alternativa Nodemon neposkytují vestavěné funkce pro přímou manipulaci s velikostí konzolového okna. Jelikož se jedná pouze o cvičnou úlohu, rozhodl jsem se požádat uživatele o ruční úpravu okna konzole, aby mapa byla vykreslená celá. 
