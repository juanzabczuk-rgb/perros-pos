export function calcularTotal(items: { price: number; quantity: number }[]) {
  return items.reduce((s, it) => s + it.price * it.quantity, 0);
}
