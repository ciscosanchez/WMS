import {
  DEFAULT_COMMON_ATTRIBUTE_FLAGS,
  extractCommonAttributeFlags,
  mergeCommonAttributeFlags,
} from "@/modules/attributes/form-metadata";

describe("attribute form metadata helpers", () => {
  it("extracts common flags from behavior flags", () => {
    expect(
      extractCommonAttributeFlags({
        searchable: true,
        allocatable: false,
        showOnLabel: true,
        showOnManifest: true,
        ignored: "value",
      })
    ).toEqual({
      searchable: true,
      allocatable: false,
      showOnLabel: true,
      showOnManifest: true,
      showOnPackingList: false,
    });
  });

  it("merges common flags without discarding advanced flags", () => {
    expect(
      mergeCommonAttributeFlags(
        { customRule: "room", searchable: false, showOnManifest: true },
        {
          ...DEFAULT_COMMON_ATTRIBUTE_FLAGS,
          searchable: true,
          showOnLabel: true,
        }
      )
    ).toEqual({
      customRule: "room",
      searchable: true,
      showOnLabel: true,
    });
  });
});
