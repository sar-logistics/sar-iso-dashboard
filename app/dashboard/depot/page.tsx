import { redirect } from "next/navigation";

export default function DepotRedirect() {
  redirect("/dashboard/mr?tab=depot");
}
