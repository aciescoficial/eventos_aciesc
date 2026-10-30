"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { AdminPage } from "@/components/admin-page";
import { Alert, Button, Card, Select, Spinner, TextInput, cx } from "@/components/ui";
import { dateShort, dateTime, errorMessage, time } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { DoorRow } from "../participantes/participants";

type DoorEvent = { event_id: string; title: string; date_id: string; starts_at: string; ends_at: string; label: string | null };
type Stored = { at: string; rows: DoorRow[] };
type Queued = { payload: string; kind: "in" | "out"; at: string };
type Result = { result: string; name?: string; at?: string; offline?: boolean };

const RESULT: Record<string, { text: string; cls: string }> = {
  ok: { text: "LIBERADO", cls: "bg-accent text-on-accent" },
  already_used: { text: "JÁ UTILIZADO", cls: "bg-error-fg text-white" },
  pending_payment: { text: "PAGAMENTO PENDENTE", cls: "bg-pending-bg text-pending-fg" },
  other_event: { text: "OUTRO EVENTO", cls: "bg-error-fg text-white" },
  invalid: { text: "INVÁLIDO", cls: "bg-error-fg text-white" },
  cancelled: { text: "CANCELADO", cls: "bg-error-fg text-white" },
  no_checkin: { text: "SEM ENTRADA", cls: "bg-pending-bg text-pending-fg" },
};

function readJson<T>(key: string, fallback: T): T {
  if (!key || typeof localStorage === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

const listKey = (d: string) => `portaria:list:${d}`;
const queueKey = (d: string) => `portaria:queue:${d}`;
const deviceId = () => {
  let id = localStorage.getItem("portaria:device");
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    localStorage.setItem("portaria:device", id);
  }
  return id;
};

declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
  }
}

export function Door() {
  return (
    <AdminPage title="Portaria" roles={["organizer", "door"]}>
      {() => <DoorApp />}
    </AdminPage>
  );
}

function DoorApp() {
  const [events, setEvents] = useState<DoorEvent[] | null>(null);
  const [dateId, setDateId] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("portaria:date") ?? "" : ""));
  const [stored, setStored] = useState<Stored | null>(() => readJson(dateId ? listKey(dateId) : "", null));
  const [queue, setQueue] = useState<Queued[]>(() => readJson(dateId ? queueKey(dateId) : "", []));
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<{ v: string; t: number }>({ v: "", t: 0 });

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    getSupabase().rpc("door_events").then(({ data, error }) => {
      if (error) {
        const cached = localStorage.getItem("portaria:events");
        setEvents(cached ? JSON.parse(cached) : []);
      } else {
        localStorage.setItem("portaria:events", JSON.stringify(data));
        setEvents(data as unknown as DoorEvent[]);
      }
    });
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);

  function selectDate(id: string) {
    setDateId(id);
    localStorage.setItem("portaria:date", id);
    setStored(readJson(listKey(id), null));
    setQueue(readJson(queueKey(id), []));
  }

  const saveStored = (s: Stored) => {
    setStored(s);
    localStorage.setItem(listKey(dateId), JSON.stringify(s));
  };
  const saveQueue = (q: Queued[]) => {
    setQueue(q);
    localStorage.setItem(queueKey(dateId), JSON.stringify(q));
  };

  async function download() {
    setError(null);
    const { data, error } = await getSupabase().rpc("door_list", { p_event_date_id: dateId });
    if (error) return setError(errorMessage(error));
    saveStored({ at: new Date().toISOString(), rows: data as unknown as DoorRow[] });
  }

  async function sync() {
    const pending = [...queue];
    const left: Queued[] = [];
    for (const q of pending) {
      const { error } = await getSupabase().rpc("checkin", { p_payload: q.payload, p_event_date_id: dateId, p_kind: q.kind, p_device_id: deviceId(), p_at: q.at });
      if (error) left.push(q);
    }
    saveQueue(left);
    if (!left.length) await download();
  }

  // Validação local (assinatura + estado) para funcionar sem internet.
  const localCheck = useCallback(
    (payload: string): Result => {
      const [code, sig] = payload.trim().toUpperCase().split(".");
      const row = stored?.rows.find((r) => r.code === code);
      if (!row) return { result: "invalid" };
      if (sig && sig.toLowerCase() !== row.sig) return { result: "invalid" };
      if (row.order_status !== "paid") return { result: "pending_payment", name: row.name };
      if (row.status === "cancelled") return { result: "cancelled", name: row.name };
      if (row.in_at) return { result: "already_used", name: row.name, at: row.in_at };
      return { result: "ok", name: row.name };
    },
    [stored],
  );

  const handle = useCallback(
    async (payload: string) => {
      const value = payload.trim();
      if (!value || !dateId) return;
      const now = Date.now();
      if (lastScan.current.v === value && now - lastScan.current.t < 3000) return;
      lastScan.current = { v: value, t: now };

      const local = localCheck(value);
      let res: Result = local;
      if (navigator.onLine) {
        const { data, error } = await getSupabase().rpc("checkin", { p_payload: value, p_event_date_id: dateId, p_kind: "in", p_device_id: deviceId() });
        if (!error) res = data as Result;
        else if (local.result === "ok") {
          res = { ...local, offline: true };
          saveQueue([...queue, { payload: value, kind: "in", at: new Date().toISOString() }]);
        }
      } else if (local.result === "ok") {
        res = { ...local, offline: true };
        saveQueue([...queue, { payload: value, kind: "in", at: new Date().toISOString() }]);
      }
      if (res.result === "ok" && stored) {
        const code = value.toUpperCase().split(".")[0];
        saveStored({ ...stored, rows: stored.rows.map((r) => (r.code === code ? { ...r, in_at: new Date().toISOString(), status: "used" } : r)) });
      }
      setResult(res);
      if ("vibrate" in navigator) navigator.vibrate(res.result === "ok" ? 80 : [80, 60, 80]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateId, localCheck, queue, stored],
  );

  // Câmera: BarcodeDetector quando disponível; senão jsQR.
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stop) return;
          if (v.readyState >= 2) {
            try {
              if (detector) {
                const codes = await detector.detect(v);
                if (codes[0]) handle(codes[0].rawValue);
              } else if (ctx) {
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                ctx.drawImage(v, 0, 0);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
                if (code?.data) handle(code.data);
              }
            } catch {}
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        setError(`Não foi possível abrir a câmera: ${errorMessage(e)}`);
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, handle]);

  if (!events) return <Spinner />;
  const ev = events.find((e) => e.date_id === dateId);
  const checked = stored?.rows.filter((r) => r.in_at).length ?? 0;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className={cx("rounded-xl px-3 py-2 text-center text-sm font-semibold", online ? "bg-tint text-brand" : "bg-pending-bg text-pending-fg")} role="status">
        {online ? "Online" : "Sem internet — validando pela lista baixada"}
        {queue.length > 0 && ` · ${queue.length} check-in(s) para sincronizar`}
      </div>
      {!events.length ? (
        <Alert tone="warn">Nenhum evento atribuído a você.</Alert>
      ) : (
        <Select label="Evento" value={dateId} onChange={(e) => selectDate(e.target.value)}>
          <option value="">Selecione…</option>
          {events.map((e) => (
            <option key={e.date_id} value={e.date_id}>
              {e.title} · {e.label || dateShort(e.starts_at)} {time(e.starts_at)}
            </option>
          ))}
        </Select>
      )}
      {error && <Alert>{error}</Alert>}
      {ev && (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              {stored ? (
                <>
                  Lista: <strong>{stored.rows.length}</strong> ingressos · {checked} entraram
                  <span className="block text-xs text-muted">Baixada {dateTime(stored.at)}</span>
                </>
              ) : (
                "Baixe a lista para validar sem internet."
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={download} disabled={!online}>{stored ? "Atualizar lista" : "Baixar lista"}</Button>
              {queue.length > 0 && <Button onClick={sync} disabled={!online}>Sincronizar</Button>}
            </div>
          </Card>

          {result && (
            <div className={cx("rounded-2xl p-6 text-center", RESULT[result.result]?.cls ?? "bg-error-fg text-white")} role="alert">
              <p className="text-3xl font-black">{RESULT[result.result]?.text ?? result.result}</p>
              {result.name && <p className="mt-1 text-xl font-bold">{result.name}</p>}
              {result.at && <p className="text-sm">às {time(result.at)}</p>}
              {result.offline && <p className="mt-1 text-xs">Registrado no aparelho — será sincronizado.</p>}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className={cx("aspect-square w-full object-cover", !scanning && "hidden")} muted playsInline />
          </div>
          <Button onClick={() => setScanning((s) => !s)} className="w-full text-lg">
            {scanning ? "Parar câmera" : "Ler QR Code com a câmera"}
          </Button>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handle(manual);
              setManual("");
            }}
          >
            <div className="flex-1"><TextInput label="Código do ingresso" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} autoComplete="off" /></div>
            <Button type="submit" variant="secondary">Validar</Button>
          </form>
        </>
      )}
    </div>
  );
}
