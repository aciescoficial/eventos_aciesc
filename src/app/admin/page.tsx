import type { Metadata } from "next";
import { AdminHome } from "./admin-home";

export const metadata: Metadata = { title: "Eventos" };

export default function Page() {
  return <AdminHome />;
}
