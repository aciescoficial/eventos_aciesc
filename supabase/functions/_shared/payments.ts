// Interface do gateway de pagamento (decisão pendente #1: Asaas ou Mercado Pago).
// Implemente um provider por gateway seguindo a documentação oficial e selecione com PAYMENT_PROVIDER.

export type Order = {
  id: string;
  total: number;
  installments: number;
  buyer_email: string;
  buyer_name: string;
  buyer_cpf: string;
  description: string;
};

export type PixCharge = { providerRef: string; qrImage: string; copyPaste: string; expiresAt: string };
export type CardCharge = { providerRef: string; checkoutUrl: string };
export type PaymentStatus = "paid" | "pending" | "failed" | "cancelled" | "refunded";
export type WebhookEvent = { eventId: string; orderId: string; providerRef: string; status: PaymentStatus };

export interface PaymentProvider {
  name: string;
  createPixCharge(order: Order): Promise<PixCharge>;
  // Cartão sempre por checkout hospedado/tokenizado do gateway: dados do cartão nunca passam por aqui.
  createCardCharge(order: Order): Promise<CardCharge>;
  getPayment(providerRef: string): Promise<{ status: PaymentStatus }>;
  refund(providerRef: string, amount?: number): Promise<void>;
  // Valida assinatura/token do webhook e normaliza o evento. Retorna null se inválido.
  verifyWebhook(req: Request, rawBody: string): Promise<WebhookEvent | null>;
}

export class PaymentNotConfiguredError extends Error {
  constructor() {
    super("Gateway de pagamento não configurado.");
  }
}

const notConfigured: PaymentProvider = {
  name: "none",
  createPixCharge: () => Promise.reject(new PaymentNotConfiguredError()),
  createCardCharge: () => Promise.reject(new PaymentNotConfiguredError()),
  getPayment: () => Promise.reject(new PaymentNotConfiguredError()),
  refund: () => Promise.reject(new PaymentNotConfiguredError()),
  verifyWebhook: () => Promise.resolve(null),
};

const providers: Record<string, PaymentProvider> = {
  // asaas: asaasProvider,       // implementar quando a decisão #1 for tomada
  // mercadopago: mercadoPagoProvider,
};

export function paymentProvider(): PaymentProvider {
  return providers[Deno.env.get("PAYMENT_PROVIDER") ?? ""] ?? notConfigured;
}
