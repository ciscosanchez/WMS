import { getChannels } from "@/modules/channels/actions";
import { ChannelsClient } from "./channels-client";

export default async function ChannelsPage() {
  const channels = await getChannels();
  return <ChannelsClient channels={channels} />;
}
