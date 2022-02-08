#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";
import figlet from "figlet";
import { createSpinner } from "nanospinner";
import { RainMaker } from "./module/index.js";
import fs from "fs";
import * as json2csv from "json2csv";
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
    ]);
    let ts_vals = [];
    let num_records = 200;
    let ts_data;
    let next_id;
    let countout = 0;
    const MAX_SAMPLES = 1;
    while (num_records == 200 && countout < MAX_SAMPLES) {
      ts_data = await RMaker.getTimeSeriesData(
        answers.node,
        answers.param_name,
        1643912216,
        1644203780,
        next_id,
        200
      );
      num_records = ts_data.result.ts_data[0].params[0].num_records;
      next_id = ts_data.result.ts_data[0].next_id;
      ts_vals = [...ts_vals, ...ts_data.result.ts_data[0].params[0].values];
      console.log(ts_data.result.ts_data[0].params[0].values[num_records - 1]);
      console.log("Length of Data: " + ts_vals.length);
      countout++;
    }
    const fields = Object.keys(ts_vals[0]);
    const csv = new json2csv.Parser({ fields });
    fs.writeFile("data.csv", csv.parse(ts_vals), (err) => {
      if (err) {
        console.error(err);
        throw err;
      }
    });
    return ts_data;
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
await askCredentials();
let isAuth = await getAuth(username, password);
await chooseReqs(isAuth);
