import Stripe from "stripe";

// Inicialização preguiçosa: o SDK só é construído no primeiro uso real (dentro
// de um handler de rota), nunca na importação do módulo. Isso evita que o
// build quebre na etapa de "collecting page data" do Next.js, que importa
// toda rota de API só para ler metadados — sem isso, faltar STRIPE_SECRET_KEY
// no ambiente derruba o build inteiro mesmo em rotas nunca chamadas.
let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripeClient(), prop, receiver);
  },
});
