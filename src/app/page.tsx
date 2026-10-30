import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getPublishedEvents } from "@/lib/public-data";
import { Vitrine } from "./vitrine";

export default async function Home() {
  const events = await getPublishedEvents();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-hero text-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <h1 className="max-w-3xl text-3xl font-black uppercase leading-tight sm:text-5xl">
              Eventos que <em className="font-extrabold text-accent">movem</em> o mercado imobiliário
            </h1>
            <p className="mt-4 max-w-xl text-white/85">
              Cursos, palestras e workshops da ACIESC para corretores, imobiliárias e construtoras de Santa Catarina.
            </p>
          </div>
        </section>
        <Vitrine initial={events} />
        <section className="bg-green-800 text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2">
            <div>
              <h2 className="text-2xl font-black uppercase">
                Associe-se à <em className="text-accent">ACIESC</em>
              </h2>
              <p className="mt-2 text-white/85">
                Associados com anuidade em dia participam gratuitamente dos cursos da ACIESC.
              </p>
              <a href="https://aciesc.com.br" className="btn-primary mt-4">Quero me associar</a>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase">
                Seja <em className="text-accent">Adepto</em> — grátis
              </h2>
              <p className="mt-2 text-white/85">
                Adepto é a forma gratuita de fazer parte da ACIESC. Marque a opção na sua próxima inscrição.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-3xl px-4 py-12">
          <h2 className="text-2xl font-extrabold">Perguntas frequentes</h2>
          <div className="mt-4 flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-2xl border border-line bg-white p-4">
                <summary className="min-h-6 cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const FAQ: [string, string][] = [
  ["Preciso criar conta para me inscrever?", "Não. Basta informar seus dados na inscrição. Depois, entre com o mesmo e-mail em “Meus ingressos” para ver seus ingressos e certificados."],
  ["Como sei o preço para o meu perfil?", "O preço depende do seu vínculo com a ACIESC (associado, adepto ou sem vínculo) e é confirmado pelo CPF na inscrição."],
  ["Há taxa de serviço?", "Não. O valor exibido é o valor que você paga."],
  ["Onde está meu ingresso?", "Enviamos por e-mail após a inscrição e ele também fica em “Meus ingressos”, com QR Code para a entrada."],
  ["Como recebo o certificado?", "Para quem fez check-in, o certificado é enviado no dia seguinte ao evento e fica disponível em “Meus ingressos”."],
];
