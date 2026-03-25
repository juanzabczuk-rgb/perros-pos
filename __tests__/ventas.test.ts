import { calcularTotal } from '../src/utils/ventas';

describe('calcularTotal', () => {
  it('suma items correctamente', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 }
    ];
    expect(calcularTotal(items)).toBe(250);
  });
});
