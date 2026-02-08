import {
  cartesianToPolar,
  normalizeAngle,
  polarToCartesian,
  shortestAngularDistance,
  TAU,
} from "../../../features/rehoboam/layout/polar";
import type { CartesianCoordinate } from "../../../features/rehoboam/layout/polar";

const degreesToRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

describe("normalizeAngle", () => {
  it("normalizes angles into [0, 2pi)", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(TAU)).toBe(0);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeAngle(13 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe("shortestAngularDistance", () => {
  it("returns the shortest signed distance between two angles", () => {
    expect(
      shortestAngularDistance(degreesToRadians(350), degreesToRadians(10))
    ).toBeCloseTo(degreesToRadians(20));

    expect(
      shortestAngularDistance(degreesToRadians(10), degreesToRadians(350))
    ).toBeCloseTo(degreesToRadians(-20));
  });

  it("returns +pi when angles are opposite", () => {
    expect(shortestAngularDistance(0, Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe("polar/cartesian conversions", () => {
  const center: CartesianCoordinate = { x: 100, y: 100 };

  it("maps 12 o'clock to negative Y in cartesian space", () => {
    expect(polarToCartesian({ radius: 12, angleRad: 0 }, center)).toEqual({
      x: 100,
      y: 88,
    });
  });

  it("maps 3 o'clock to positive X in cartesian space", () => {
    expect(
      polarToCartesian({ radius: 10, angleRad: Math.PI / 2 }, center)
    ).toEqual({
      x: 110,
      y: 100,
    });
  });

  it("roundtrips polar -> cartesian -> polar", () => {
    const samples = [
      { radius: 8, angleRad: 0 },
      { radius: 12, angleRad: Math.PI / 4 },
      { radius: 20, angleRad: Math.PI },
      { radius: 24, angleRad: (7 * Math.PI) / 4 },
    ];

    for (const sample of samples) {
      const point = polarToCartesian(sample, center);
      const polar = cartesianToPolar(point, center);

      expect(polar.radius).toBeCloseTo(sample.radius);
      expect(polar.angleRad).toBeCloseTo(normalizeAngle(sample.angleRad));
    }
  });
});
