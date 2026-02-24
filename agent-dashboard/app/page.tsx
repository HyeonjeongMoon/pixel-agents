import Dashboard from "@/components/Dashboard";
import { loadEvents, loadSnapshot } from "@/lib/mockStore";

export default function HomePage() {
  const snapshot = loadSnapshot();
  const events = loadEvents();

  return <Dashboard initialSnapshot={snapshot} events={events} />;
}
