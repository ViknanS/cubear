declare module 'cubejs' {
  class Cube {
    constructor();
    static initSolver(): void;
    static fromString(s: string): Cube;
    static random(): Cube;
    static inverse(alg: string): string;
    asString(): string;
    move(alg: string): Cube;
    solve(maxDepth?: number): string;
    isSolved(): boolean;
    clone(): Cube;
  }
  export default Cube;
}
