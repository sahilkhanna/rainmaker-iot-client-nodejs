function checkIfSuccesCode(params) {
  if (typeof params != "number") {
    throw new Error("Argument is not a number");
  }
  return params.toString()[0] === "2";
}
