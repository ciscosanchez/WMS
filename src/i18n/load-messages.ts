const TENANT_MESSAGE_FILES = [
  "tenant-overview",
  "tenant-receiving",
  "tenant-fulfillment",
  "tenant-inventory",
  "tenant-admin",
] as const;

type MessageTree = Record<string, unknown>;

function mergeMessageTrees(base: MessageTree, patch: MessageTree): MessageTree {
  const result: MessageTree = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    if (
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = mergeMessageTrees(existing as MessageTree, value as MessageTree);
      continue;
    }

    result[key] = value;
  }

  return result;
}

async function importLocaleFile(locale: string, namespace: string): Promise<MessageTree> {
  return (await import(`./locales/${locale}/${namespace}.json`)).default as MessageTree;
}

export async function loadLocaleMessages(locale: string, namespace: string): Promise<MessageTree> {
  if (namespace !== "tenant") {
    return importLocaleFile(locale, namespace);
  }

  let merged: MessageTree = {};
  for (const file of TENANT_MESSAGE_FILES) {
    merged = mergeMessageTrees(merged, await importLocaleFile(locale, file));
  }

  return merged;
}
