export type CommonAttributeFlagState = {
  searchable: boolean;
  allocatable: boolean;
  showOnLabel: boolean;
  showOnManifest: boolean;
  showOnPackingList: boolean;
};

export const DEFAULT_COMMON_ATTRIBUTE_FLAGS: CommonAttributeFlagState = {
  searchable: false,
  allocatable: false,
  showOnLabel: false,
  showOnManifest: false,
  showOnPackingList: false,
};

export function extractCommonAttributeFlags(
  flags: Record<string, unknown>
): CommonAttributeFlagState {
  return {
    searchable: flags.searchable === true,
    allocatable: flags.allocatable === true,
    showOnLabel: flags.showOnLabel === true,
    showOnManifest: flags.showOnManifest === true,
    showOnPackingList: flags.showOnPackingList === true,
  };
}

export function mergeCommonAttributeFlags(
  flags: Record<string, unknown>,
  commonFlags: CommonAttributeFlagState
) {
  const next = { ...flags };
  for (const [key, value] of Object.entries(commonFlags)) {
    if (value) next[key] = true;
    else delete next[key];
  }
  return next;
}
