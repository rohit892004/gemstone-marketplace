import { permanentRedirect } from "next/navigation";

/** The education section moved to /education. Old links (including the homepage default) land there. */
export default function LearnPage() {
  permanentRedirect("/education");
}
