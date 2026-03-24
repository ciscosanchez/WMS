import { getPickTasks, getPickingKpis } from "@/modules/picking/actions";
import { PickingClient } from "./picking-client";

export default async function PickingPage() {
  const [tasks, kpis] = await Promise.all([getPickTasks(), getPickingKpis()]);

  return <PickingClient tasks={tasks} kpis={kpis} />;
}
