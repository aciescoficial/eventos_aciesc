// Interface de WhatsApp (decisão pendente #2: HUB7 ou Meta Cloud API, com modelos aprovados).
export interface MessagingProvider {
  name: string;
  sendTemplate(to: string, template: string, variables: Record<string, string>): Promise<void>;
}

const providers: Record<string, MessagingProvider> = {
  // hub7: hub7Provider,
  // meta: metaCloudProvider,
};

export function messagingProvider(): MessagingProvider | null {
  return providers[Deno.env.get("WHATSAPP_PROVIDER") ?? ""] ?? null;
}
