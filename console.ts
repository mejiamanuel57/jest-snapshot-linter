import { Criteria, Report, TestError } from "./types";
import Logger from "./logger";

const sortByType = (a: TestError, b: TestError): -1 | 0 | 1 => {
  if (a.type < b.type) {
    return -1;
  }

  if (a.type > b.type) {
    return 1;
  }

  return 0;
};

type Options = {
  errorsOnly?: boolean;
  isVerbose?: boolean;
};

export default (
  criteria: Criteria,
  sas: Report[],
  opts: Options = {}
): void => {
  const logger = new Logger({
    errorsOnly: opts.errorsOnly,
    isVerbose: opts.isVerbose
  });

  sas.forEach(sa => {
    logger.log(sa.path);

    if (sa.errors.length > 0) {
      logger.error("Snapshot errors:");
    }

    sa.errors.forEach(e => {
      logger.error(
        `• ${e.size} bytes is larger than ${
          criteria.maxFileSize
        }, consider breaking your tests into separate snapshot files`
      );
    });

    let hasErrors = false;
    let hasWarnings = false;

    sa.lints.forEach(l => {
      if (l.error || l.errors.length > 0 || l.warnings.length > 0) {
        logger.log(l.key);
      }

      if (l.error) {
        hasErrors = true;
        logger.error(`Snapshot could not be parsed: ${l.error}`);
        return;
      }

      if (l.errors.length > 0) {
        hasErrors = true;
      }

      l.errors.sort(sortByType);

      l.errors.forEach(e => {
        if (e.type === "GENERIC_ATTR") {
          logger.error(
            `Generic Attributes: ${e.elementName} has ${e.attributes}, max (${
              criteria.genericAttrs
            })`
          );
        }

        if (e.type === "GENERIC_VALUE" && criteria.genericValues) {
          logger.error(
            `Generic Values: ${e.elementName} has ${
              e.values
            }, disallowed [${criteria.genericValues.join(", ")}]`
          );
        }

        if (e.type === "MAX_ATTR") {
          logger.error(
            `Maximum Attributes: ${e.elementName} has ${
              e.count
            } attributes, max (${criteria.maxAttr})`
          );
        }

        if (e.type === "MAX_ATTR_ARR_LENGTH") {
          logger.error(
            `Maximum Attribute Array Length: ${e.elementName} ${
              e.attributeName
            } has a length of ${e.attributeLength}, max (${
              criteria.maxAttrArrayLength
            })`
          );
        }

        if (e.type === "MAX_ATTR_STR_LENGTH") {
          logger.error(
            `Maximum Attribute String Length: ${e.elementName} ${
              e.attributeName
            } has a length of ${e.attributeLength}, max (${
              criteria.maxAttrStringLength
            })`
          );
        }

        if (e.type === "MAX_DEPTH") {
          logger.error(
            `Maximum Depth: ${e.leafElementName} has a depth of ${
              e.depth
            }, max (${criteria.maxDepth})`
          );
        }

        if (e.type === "MAX_LINES") {
          logger.error(
            `Maximum Lines: ${e.count} lines is longer than ${
              criteria.maxLines
            }, consider breaking this snapshot down`
          );
        }
      });

      if (l.warnings.length > 0) {
        hasWarnings = true;
      }

      l.warnings.forEach(w => {
        if (w.type !== "NO_ELEMENTS_FOUND") {
          logger.warn(
            `Max Generic Elements: Too many (${w.count}) generic elements (${
              w.elementName
            }) reduce the clarity of a snapshot, max(${
              criteria.maxGenericElement
            })`
          );
        }
      });
    });

    if (
      sa.errors.length === 0 &&
      sa.warnings.length === 0 &&
      !hasErrors &&
      !hasWarnings
    ) {
      logger.success("No issues ✔️");
    }
  });
};
