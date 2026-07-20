'use server'; // Wait, let's make it a client component since it needs interactive navigation or state. Or we can just use Client Component format:
import LandingClient from './LandingClient';

export default async function LandingPage() {
  return <LandingClient />;
}
