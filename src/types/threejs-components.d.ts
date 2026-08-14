declare module "threejs-components/build/cursors/tubes1.min.js" {
  export interface TubesCursorApp {
    tubes: {
      setColors(colors: string[]): void;
      setLightsColors(colors: string[]): void;
    };
    dispose(): void;
  }

  interface TubesCursorOptions {
    tubes?: {
      colors?: string[];
      lights?: {
        intensity?: number;
        colors?: string[];
      };
    };
    bloom?: {
      threshold?: number;
      strength?: number;
      radius?: number;
    };
    sleepRadiusX?: number;
    sleepRadiusY?: number;
    sleepTimeScale1?: number;
    sleepTimeScale2?: number;
  }

  function TubesCursor(
    canvas: HTMLCanvasElement,
    options?: TubesCursorOptions,
  ): TubesCursorApp;

  export default TubesCursor;
}
