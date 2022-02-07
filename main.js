#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import { RainMaker } from "./module/index.js";

const SUCCESSRESP = 200;
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));
let username = "";
let password = "";
let RMaker = new RainMaker("", "");
async function askCredentials() {
  let answers = await inquirer.prompt([
    {
      name: "username",
      type: "input",
      message: "Enter username =",
    },
    {
      name: "password",
      type: "password",
      message: "Enter password =",
    },
  ]);
  username = answers.username;
  password = answers.password;
}

async function loginResult(isCorrect, spinner) {
  if (isCorrect === true) {
    spinner.success({ text: `Successfuly Logged in as ${username}` });
    return true;
  } else {
    const err = JSON.stringify(isCorrect);
    spinner.error({
      text: `💀💀💀 Authentication failed with error code ${err}, try again ${username}!`,
    });
    return false;
  }
}

async function getAuth(username, password) {
  RMaker = new RainMaker(username, password);
  const spinner = createSpinner("Checking credentials...").start();
  return loginResult(await RMaker.authenticate(), spinner);
}

async function reqResult(response, spinner) {
  if (response.status === SUCCESSRESP) {
    spinner.success({
      text: `Request successful with response`,
    });
    console.dir(response.result);
    return true;
  } else {
    spinner.error({
      text: `💀💀💀 Request failed with error code ${response.status}, and response`,
    });
    console.dir(response.result);
    return false;
  }
}

async function getNodesList() {
  return await RMaker.getUserNodes(false);
}

async function getNodesListDetailed() {
  return await RMaker.getUserNodes(true);
}

async function chooseReqs(isAuth) {
  if (!isAuth) {
    throw new Error("Not Authenticated");
  }
  const requests = [
    { msg: "Get Nodes List", func: getNodesList },
    { msg: "Get Nodes List with Details", func: getNodesListDetailed },
  ];
  let answers = await inquirer.prompt([
    {
      type: "list",
      name: "req",
      message: "Choose the Following Requests?",
      choices: requests.map((req) => {
        return req.msg;
      }),
    },
  ]);
  const req = requests.filter((req) => req.msg === answers.req);
  const doReq = req[0].func;
  const spinner = createSpinner("Performing Request...").start();
  return reqResult(await doReq(), spinner);
}
await askCredentials();
let isAuth = await getAuth(username, password);
await chooseReqs(isAuth);
