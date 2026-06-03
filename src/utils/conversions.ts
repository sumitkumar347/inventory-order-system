import { Decimal } from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type Unit = 'g' | 'kg' | 'L' | 'mL' | 'item';

export const UNIT_DIMENSIONS: Record<Unit, string> = {
  g: 'weight',
  kg: 'weight',
  L: 'volume',
  mL: 'volume',
  item: 'count',
};

export const DISPLAY_UNIT_NAMES: Record<Unit, string> = {
  g: 'Grams (g)',
  kg: 'Kilograms (kg)',
  L: 'Liters (L)',
  mL: 'Milliliters (mL)',
  item: 'Items (count)',
};

export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const dimA = UNIT_DIMENSIONS[unitA as Unit];
  const dimB = UNIT_DIMENSIONS[unitB as Unit];
  return !!dimA && dimA === dimB;
}

export function getCompatibleUnits(baseUnit: string): Unit[] {
  const dim = UNIT_DIMENSIONS[baseUnit as Unit];
  if (!dim) return [];
  return Object.keys(UNIT_DIMENSIONS).filter(
    (key) => UNIT_DIMENSIONS[key as Unit] === dim
  ) as Unit[];
}

export function getConversionFactor(fromUnit: string, toUnit: string): Decimal {
  if (fromUnit === toUnit) {
    return new Decimal(1);
  }

  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(`Incompatible units: cannot convert from ${fromUnit} to ${toUnit}`);
  }

  if (fromUnit === 'kg' && toUnit === 'g') {
    return new Decimal(1000);
  }
  if (fromUnit === 'g' && toUnit === 'kg') {
    return new Decimal(0.001);
  }

  if (fromUnit === 'L' && toUnit === 'mL') {
    return new Decimal(1000);
  }
  if (fromUnit === 'mL' && toUnit === 'L') {
    return new Decimal(0.001);
  }

  return new Decimal(1);
}

export function convertQuantity(quantity: number | string | Decimal, fromUnit: string, toUnit: string): Decimal {
  const qty = new Decimal(quantity);
  const factor = getConversionFactor(fromUnit, toUnit);
  return qty.times(factor);
}

export function calculateOrderPrice(
  orderedQuantity: number | string | Decimal,
  orderedUnit: string,
  baseUnit: string,
  basePrice: number | string | Decimal
): {
  conversionFactor: Decimal;
  baseQuantity: Decimal;
  calculatedPrice: Decimal;
} {
  const qty = new Decimal(orderedQuantity);
  const price = new Decimal(basePrice);
  
  const factor = getConversionFactor(orderedUnit, baseUnit);
  const baseQty = qty.times(factor);
  const calcPrice = baseQty.times(price);
  
  return {
    conversionFactor: factor,
    baseQuantity: baseQty,
    calculatedPrice: calcPrice,
  };
}
