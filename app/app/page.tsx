import { LandingPage } from "@/components/landing/LandingPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <LandingPage />;
}
