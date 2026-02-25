import Dashboard from "@/components/Dashboard";
import { loadAgentEvents, loadStateSnapshot, resolveDataSource } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{
    source?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const dataSource = resolveDataSource(params?.source);
  const snapshot = loadStateSnapshot(dataSource);
  const events = loadAgentEvents(dataSource);

  return <Dashboard initialSnapshot={snapshot} events={events} dataSource={dataSource} />;
}
