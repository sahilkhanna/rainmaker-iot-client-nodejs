#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import DatePrompt from "inquirer-date-prompt";
inquirer.registerPrompt("date", DatePrompt);
// import gradient from "gradient-string";
// import chalkAnimation from "chalk-animation";
// import figlet from "figlet";
import { createSpinner } from "nanospinner";
// import { RainMaker } from "./module/index.js";
import RainMaker from "rainmaker-client";
import fs from "fs";
import * as json2csv from "json2csv";
// import { dir } from "console";
const SUCCESSRESP = 200;
const { cred } = JSON.parse(fs.readFileSync("./cred.json"));
let username = cred.username;
let password = cred.password;

let RMaker = new RainMaker(username, password);

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
  if (isCorrect.status === SUCCESSRESP) {
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

async function getTsData(spinner) {
  const list = await getNodesList();
  spinner.stop();
  if (list.status === 200) {
    let answers = await inquirer.prompt([
      {
        type: "list",
        name: "node",
        message: "Select node:",
        choices: list.result.nodes,
      },
      {
        type: "input",
        name: "param_name",
        message: "Type param name",
      },
      {
        type: "date",
        name: "start_time",
        message: "Choose Start Time: ",
        prefix: " ⏰ ",
        filter: (d) => Math.floor(d.getTime() / 1000),
        validate: (t) =>
          t * 1000 < Date.now() + 86400000 || "Cannot get future time",
        transformer: (s) => chalk.bold.red(s),
        locale: "en-AU",
        clearable: true,
      },
      {
        type: "date",
        name: "end_time",
        message: "Choose End Time: ",
        prefix: " ⏰ ",
        filter: (d) => Math.floor(d.getTime() / 1000),
        validate: (t) =>
          t * 1000 < Date.now() + 86400000 || "Cannot get future time",
        transformer: (s) => chalk.bold.red(s),
        locale: "en-AU",
        clearable: true,
      },
    ]);
    console.log(answers);
    let ts_vals = [];
    let num_records = 200;
    let ts_data;
    let next_id;
    let countout = 0;
    const MAX_SAMPLES = 30;
    spinner.start();
    spinner.update({ text: "Acquiring Samples..." });
    while (num_records == 200 && countout < MAX_SAMPLES) {
      ts_data = await RMaker.getTimeSeriesData(
        answers.node,
        answers.param_name,
        answers.start_time,
        answers.end_time,
        next_id,
        200
      );
      num_records = ts_data.result.ts_data[0].params[0].num_records;
      next_id = ts_data.result.ts_data[0].next_id;
      ts_vals = [...ts_vals, ...ts_data.result.ts_data[0].params[0].values];
      spinner.update({
        text: "Acquiring Samples... Data Points acquired: " + ts_vals.length,
      });
      countout++;
    }
    const fields = Object.keys(ts_vals[0]);
    const csv = new json2csv.Parser({ fields });
    const csv_f_name =
      "data/" +
      answers.node +
      "_" +
      answers.param_name +
      answers.start_time +
      "-" +
      answers.end_time +
      ".csv";
    fs.writeFile(csv_f_name, csv.parse(ts_vals), (err) => {
      if (err) {
        spinner.stop();
        console.error(err);
        throw err;
      }
    });
    return { status: 200, result: ts_vals };
  } else {
    return list;
  }
}

async function getNodeParams(spinner) {
  const list = await getNodesList();
  spinner.stop();
  if (list.status === 200) {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "node",
        message: "Select node:",
        choices: list.result.nodes,
      },
    ]);
    spinner.start();
    spinner.update({ text: "Acquiring All Parameters Data..." });
    return await RMaker.getAllNodeParams(answers.node);
  } else {
    return list;
  }
}

async function setNodeParamValue(spinner) {
  const list = await getNodesList();
  spinner.stop();
  if (list.status === 200) {
    let answer = await inquirer.prompt([
      {
        type: "list",
        name: "node",
        message: "Select node:",
        choices: list.result.nodes,
      },
    ]);
    spinner.start();
    spinner.update({ text: "Acquiring All Parameters Data..." });
    let node = answer.node;
    const paramData = await RMaker.getAllNodeParams(node);
    spinner.stop();
    answer = await inquirer.prompt([
      {
        type: "list",
        name: "device",
        message: "Choose the Following Device?",
        choices: Object.keys(paramData.result),
      },
    ]);
    let device = answer.device;
    answer = await inquirer.prompt([
      {
        type: "list",
        name: "param",
        message: "Choose the Following Param?",
        choices: Object.keys(paramData.result[answer.device]),
      },
    ]);
    let param = answer.param;
    const listTypes = [
      { msg: "String", type: "input" },
      { msg: "Boolean", type: "confirm" },
      { msg: "Integer", type: "number" },
      { msg: "Float", type: "number" },
    ];
    answer = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Choose Value Type",
        choices: listTypes.map((list) => {
          return list.msg;
        }),
      },
    ]);
    const type = listTypes.filter((type) => type.msg === answer.type);
    answer = await inquirer.prompt([
      {
        type: type[0].type,
        name: "value",
        message: "Enter Value for " + device + "." + param + "= ",
      },
    ]);
    spinner.start();
    spinner.update({
      text: "Setting " + device + "." + param + "=" + answer.value + "...",
    });
    return await RMaker.setNodeParamValue(node, device, param, answer.value);
  } else {
    return list;
  }
}
async function getApiClient() {
  return RMaker.getApiFunctions();
}
async function chooseReqs(isAuth) {
  if (!isAuth) {
    throw new Error("Not Authenticated");
  }
  const requests = [
    { msg: "Get Nodes List", func: getNodesList },
    { msg: "Get Nodes List with Details", func: getNodesListDetailed },
    { msg: "Get time Series Data", func: getTsData },
    { msg: "Get api client", func: getApiClient },
    { msg: "Get Node Params", func: getNodeParams },
    { msg: "Set a Node Param's value", func: setNodeParamValue },
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
  return reqResult(await doReq(spinner), spinner);
}
// await askCredentials();
let isAuth = await getAuth(username, password);
await chooseReqs(isAuth);
