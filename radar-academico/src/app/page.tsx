import { redirect } from "next/navigation";

// The standalone collector never renders a parallel public catalogue.
export default function Home() {
  redirect("https://apogee.community/oportunidades");
}
