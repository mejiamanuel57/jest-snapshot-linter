import {
  Element,
  FilePath,
  ParsedTest,
  SnapshotAnalysis,
  TestAnalysis
} from "./types";
import {
  ArrayElement,
  JSXAttribute,
  JSXElement,
  Literal,
  ObjectExpression,
  Property
} from "acorn-jsx";
import { readFile, stat } from "fs-extra";
import parse from "./parse";

const sanitiseValue = (v: Object) => {
  if (Array.isArray(v) && v.length === 1 && v[0] === "Function") {
    return "[Function]";
  }

  return v;
};

const extractProp = (prop: Property) => ({
  key: prop.key.value,
  value: sanitiseValue(prop.value.value)
});

const extractElement = (element: ArrayElement) => {
  if (element.type === "Identifier") {
    return element.name;
  } else if (element.type === "Literal") {
    return element.value;
  } else if (element.type === "UnaryExpression") {
    return element.argument.value;
  }

  return element.properties.map(extractProp);
};

const extractProps = ({ name, value }: JSXAttribute) => {
  let propValue;

  if (value.type === "Literal") {
    propValue = value.value;
  } else if (value.expression.type === "Literal") {
    propValue = value.expression.value;
  } else if (value.expression.type === "ObjectExpression") {
    propValue = value.expression.properties.map(extractProp);
  } else {
    propValue = value.expression.elements.map(extractElement);
  }

  return {
    key: name.name,
    value: sanitiseValue(propValue)
  };
};

const flatten = (depth: number) => (ys: Element[], y: JSXElement) => {
  return [...ys, ...traverse(depth)(y)];
};

const traverse = (depth: number) => (x: JSXElement): Element[] => {
  const oe = x.openingElement;
  const elementName = oe.name.name;
  const props = oe.attributes.map(extractProps);

  return [
    {
      elementName,
      props,
      depth
    },
    ...x.children
      .filter(c => c.type === "JSXElement")
      .reduce(flatten(depth + 1), [])
  ];
};

const analyseSnapshot = (snapshot: ParsedTest): TestAnalysis => {
  const snapshotLength =
    snapshot.rawValue.length - snapshot.rawValue.replace(/\n/g, "").length + 1;

  if (snapshot.value === null) {
    return {
      key: snapshot.key,
      lines: snapshotLength,
      elements: [],
      error: snapshot.error
    };
  }

  const [{ expression }] = snapshot.value.body;

  if (expression.type !== "JSXElement") {
    return {
      key: snapshot.key,
      lines: snapshotLength,
      elements: []
    };
  }

  return {
    key: snapshot.key,
    lines: snapshotLength,
    elements: traverse(0)(expression)
  };
};

export default async (snapshotPath: FilePath): Promise<SnapshotAnalysis> => ({
  path: snapshotPath,
  fileSize: (await stat(snapshotPath)).size,
  analyses: parse(await readFile(snapshotPath, "utf8")).map(analyseSnapshot)
});
