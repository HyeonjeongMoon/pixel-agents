import Dashboard from "@/components/Dashboard";
import { getDataSource, loadAgentEvents, loadStateSnapshot } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const snapshot = loadStateSnapshot();
  const events = loadAgentEvents();
  const dataSource = getDataSource();

  return <Dashboard initialSnapshot={snapshot} events={events} dataSource={dataSource} />;
}
