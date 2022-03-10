#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import DatePrompt from "inquirer-date-prompt";
inquirer.registerPrompt("date", DatePrompt);
// import gradient from "gradient-string";
// import chalkAnimation from "chalk-animation";
// import figlet from "figlet";
import { createSpinner } from "nanospinner";
import RainMaker from "rainmaker-client";
import fs from "fs";
import * as json2csv from "json2csv";
import { isSuccess, saveToFile, readFromFile } from "./util/helper.mjs";
const { cred } = JSON.parse(readFromFile("./cred.json"));
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
  if (isSuccess(isCorrect.status)) {
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
  if (isSuccess(response.status)) {
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
async function getUserGroupList() {
  return await RMaker.getUserGroupDetails(true);
}
async function getUserGroupDetails(spinner) {
  let list = await RMaker.getUserGroupDetails(true);
  spinner.stop();
  let groupIds = list.result.groups.map((grp) => {
    return { name: grp.group_name, value: grp.group_id };
  });
  if (list.status === 200) {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "groupID",
        message: "Select Group:",
        choices: groupIds,
      },
    ]);
    spinner.start();
    spinner.update({ text: "Acquiring All Parameters Data..." });
    return await RMaker.getUserGroupDetails(true, answers.groupID, true);
  } else {
    return list;
  }
}

async function getTsData(spinner) {
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
    let answers = await inquirer.prompt([
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
        node,
        device + "." + param,
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
      node +
      "_" +
      device +
      "." +
      param +
      "_" +
      answers.start_time +
      "-" +
      answers.end_time +
      ".csv";
    saveToFile(csv_f_name, csv.parse(ts_vals));
    return { status: 200, result: ts_vals };
  } else {
    return nodes;
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
      { msg: "Array", type: "input" },
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
    const inputType = listTypes.filter((type) => type.msg === answer.type);
    answer = await inquirer.prompt([
      {
        type: inputType[0].type,
        name: "value",
        message: "Enter Value for " + device + "." + param + "= ",
        filter(val) {
          if (inputType[0].msg === "Array") {
            return JSON.parse(val);
          }
          return val;
        },
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
    { name: "Get Nodes List", value: getNodesList },
    { name: "Get User Groups List", value: getUserGroupList },
    { name: "Get User Group Details", value: getUserGroupDetails },
    { name: "Get Nodes List with Details", value: getNodesListDetailed },
    { name: "Get time Series Data", value: getTsData },
    { name: "Get api client", value: getApiClient },
    { name: "Get Node Params", value: getNodeParams },
    { name: "Set a Node Param's value", value: setNodeParamValue },
  ];
  let answers = await inquirer.prompt([
    {
      type: "list",
      name: "req",
      message: "Choose the Following Requests?",
      choices: requests,
    },
  ]);
  const doReq = answers.req;
  const spinner = createSpinner("Performing Request...").start();
  return reqResult(await doReq(spinner), spinner);
}

async function main() {
  // await askCredentials();
  let isAuth = await getAuth(username, password);
  await chooseReqs(isAuth);
}

async function test() {
  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: "Enter array = ",
      filter(val) {
        console.log(val);
        return JSON.parse(val);
      },
    },
  ]);
  console.log(answer);
}
// test();
main();
