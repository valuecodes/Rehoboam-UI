export type MockCanvasContext = Readonly<{
  context: CanvasRenderingContext2D;
  commands: string[];
}>;

const formatNumber = (value: number): string => {
  return Number.isFinite(value) ? value.toFixed(4) : `${value}`;
};

const formatStyleValue = (
  value: string | CanvasGradient | CanvasPattern
): string => {
  return typeof value === "string" ? value : "[object]";
};

export const createMockCanvasContext = (): MockCanvasContext => {
  const commands: string[] = [];
  const pushCommand = (command: string) => {
    commands.push(command);
  };

  let fillStyleValue: string | CanvasGradient | CanvasPattern = "#000";
  let strokeStyleValue: string | CanvasGradient | CanvasPattern = "#000";
  let globalAlphaValue = 1;
  let lineWidthValue = 1;
  let lineDashOffsetValue = 0;
  let currentLineDash: number[] = [];

  const contextLike = {
    save: () => {
      pushCommand("save");
    },
    restore: () => {
      pushCommand("restore");
    },
    setTransform: (
      ...args:
        | readonly [number, number, number, number, number, number]
        | readonly [DOMMatrix2DInit?]
    ) => {
      if (args.length === 6) {
        const [a, b, c, d, e, f] = args as readonly number[];
        pushCommand(
          `setTransform(${formatNumber(a)},${formatNumber(b)},${formatNumber(c)},${formatNumber(d)},${formatNumber(e)},${formatNumber(f)})`
        );

        return;
      }

      pushCommand("setTransform(matrix)");
    },
    clearRect: (x: number, y: number, width: number, height: number) => {
      pushCommand(
        `clearRect(${formatNumber(x)},${formatNumber(y)},${formatNumber(width)},${formatNumber(height)})`
      );
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      pushCommand(
        `fillRect(${formatNumber(x)},${formatNumber(y)},${formatNumber(width)},${formatNumber(height)})`
      );
    },
    beginPath: () => {
      pushCommand("beginPath");
    },
    moveTo: (x: number, y: number) => {
      pushCommand(`moveTo(${formatNumber(x)},${formatNumber(y)})`);
    },
    lineTo: (x: number, y: number) => {
      pushCommand(`lineTo(${formatNumber(x)},${formatNumber(y)})`);
    },
    arc: (
      x: number,
      y: number,
      radius: number,
      startAngle: number,
      endAngle: number
    ) => {
      pushCommand(
        `arc(${formatNumber(x)},${formatNumber(y)},${formatNumber(radius)},${formatNumber(startAngle)},${formatNumber(endAngle)})`
      );
    },
    setLineDash: (segments: Iterable<number>) => {
      const values = Array.from(segments);
      currentLineDash = [...values];
      pushCommand(`setLineDash(${values.map(formatNumber).join(",")})`);
    },
    getLineDash: () => {
      return [...currentLineDash];
    },
    stroke: () => {
      pushCommand("stroke");
    },
    fill: () => {
      pushCommand("fill");
    },
  };

  Object.defineProperty(contextLike, "fillStyle", {
    get: () => fillStyleValue,
    set: (value: string | CanvasGradient | CanvasPattern) => {
      fillStyleValue = value;
      pushCommand(`fillStyle(${formatStyleValue(value)})`);
    },
  });

  Object.defineProperty(contextLike, "strokeStyle", {
    get: () => strokeStyleValue,
    set: (value: string | CanvasGradient | CanvasPattern) => {
      strokeStyleValue = value;
      pushCommand(`strokeStyle(${formatStyleValue(value)})`);
    },
  });

  Object.defineProperty(contextLike, "globalAlpha", {
    get: () => globalAlphaValue,
    set: (value: number) => {
      globalAlphaValue = value;
      pushCommand(`globalAlpha(${formatNumber(value)})`);
    },
  });

  Object.defineProperty(contextLike, "lineWidth", {
    get: () => lineWidthValue,
    set: (value: number) => {
      lineWidthValue = value;
      pushCommand(`lineWidth(${formatNumber(value)})`);
    },
  });

  Object.defineProperty(contextLike, "lineDashOffset", {
    get: () => lineDashOffsetValue,
    set: (value: number) => {
      lineDashOffsetValue = value;
      pushCommand(`lineDashOffset(${formatNumber(value)})`);
    },
  });

  return {
    context: contextLike as unknown as CanvasRenderingContext2D,
    commands,
  };
};
