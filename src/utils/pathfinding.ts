import type { CellType, GridConfig } from '../types';

// ── BFS Shortest Path ─────────────────────────────────────────

export function bfs(
  grid: CellType[][],
  start: [number, number],
  goal: [number, number]
): [number, number][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const visited = new Set<string>();
  const parent = new Map<string, [number, number] | null>();
  const queue: [number, number][] = [start];

  const key = (r: number, c: number) => `${r},${c}`;
  visited.add(key(start[0], start[1]));
  parent.set(key(start[0], start[1]), null);

  const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    if (r === goal[0] && c === goal[1]) {
      // Reconstruct path
      const path: [number, number][] = [];
      let current: [number, number] | null = [r, c];
      while (current) {
        path.unshift(current);
        current = parent.get(key(current[0], current[1])) ?? null;
      }
      return path;
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      const nk = key(nr, nc);
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(nk) && grid[nr][nc] !== 'obstacle') {
        visited.add(nk);
        parent.set(nk, [r, c]);
        queue.push([nr, nc]);
      }
    }
  }

  return []; // no path
}

// ── Grid Generation ───────────────────────────────────────────

export function generateGrid(
  width: number,
  height: number,
  obstacleDensity: number = 0.2
): GridConfig {
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    attempts++;
    const grid: CellType[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => 'empty' as CellType)
    );

    // Place start (top-left area) and goal (bottom-right area)
    const startRow = Math.floor(Math.random() * Math.ceil(height / 3));
    const startCol = Math.floor(Math.random() * Math.ceil(width / 3));
    const goalRow = height - 1 - Math.floor(Math.random() * Math.ceil(height / 3));
    const goalCol = width - 1 - Math.floor(Math.random() * Math.ceil(width / 3));

    grid[startRow][startCol] = 'start';
    grid[goalRow][goalCol] = 'goal';

    // Place obstacles
    const totalCells = width * height;
    const obstacleCount = Math.floor(totalCells * obstacleDensity);
    let placed = 0;

    while (placed < obstacleCount) {
      const r = Math.floor(Math.random() * height);
      const c = Math.floor(Math.random() * width);
      if (grid[r][c] === 'empty') {
        grid[r][c] = 'obstacle';
        placed++;
      }
    }

    // Verify path exists
    const path = bfs(grid, [startRow, startCol], [goalRow, goalCol]);
    if (path.length > 0) {
      return {
        width,
        height,
        grid,
        startPos: [startRow, startCol],
        goalPos: [goalRow, goalCol],
        optimalPathLength: path.length - 1, // steps, not positions
      };
    }
  }

  // Fallback: simple grid with no obstacles
  const grid: CellType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'empty' as CellType)
  );
  grid[0][0] = 'start';
  grid[height - 1][width - 1] = 'goal';

  return {
    width,
    height,
    grid,
    startPos: [0, 0],
    goalPos: [height - 1, width - 1],
    optimalPathLength: (height - 1) + (width - 1),
  };
}
