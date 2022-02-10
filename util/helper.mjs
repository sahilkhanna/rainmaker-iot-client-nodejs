import fs from "fs";

export function isSuccess(params) {
  if (typeof params != "number") {
    throw new Error("Argument is not a number");
  }
  return params.toString()[0] === "2";
}

export function saveToFile(fileName, data) {
  fs.writeFile(fileName, data, (err) => {
    if (err) {
      throw err;
    }
  });
}

export function readFromFile(fileLocation) {
  return fs.readFileSync(fileLocation);
}
