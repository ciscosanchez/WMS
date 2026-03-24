/**
 * Creates a locale-aware Zod error map.
 * Pass a translator function from useTranslations("validation").
 */
import { type ZodErrorMap, ZodIssueCode, ZodParsedType } from "zod";

type T = (key: string, params?: Record<string, string | number>) => string;

export function makeZodErrorMap(t: T): ZodErrorMap {
  return (issue, ctx) => {
    switch (issue.code) {
      case ZodIssueCode.too_small:
        if (issue.type === "string" && issue.minimum === 1) {
          return { message: t("required", { field: "This field" }) };
        }
        if (issue.type === "string") {
          return { message: t("minLength", { field: "This field", min: issue.minimum as number }) };
        }
        if (issue.type === "number") {
          return { message: t("minValue", { field: "This field", min: issue.minimum as number }) };
        }
        break;

      case ZodIssueCode.too_big:
        if (issue.type === "string") {
          return { message: t("maxLength", { field: "This field", max: issue.maximum as number }) };
        }
        break;

      case ZodIssueCode.invalid_string:
        if (issue.validation === "email") {
          return { message: t("invalidEmail") };
        }
        break;

      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined || issue.received === ZodParsedType.null) {
          return { message: t("required", { field: "This field" }) };
        }
        return { message: t("invalidType") };
    }

    return { message: ctx.defaultError };
  };
}
