import { redirect } from "next/navigation";

// The canonical member page validates the session before returning details.
export default function OpportunityPage() {
  redirect("https://apogee.community/membros/oportunidades");
}
