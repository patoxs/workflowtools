const core = require('@actions/core');
const github = require('@actions/github');

function runCMD(c) {
  const { exec } = require("child_process");
  exec(c, (error, stdout, stderr) => {
      if (error) {
          console.log(`error: ${error.message}`);
          return;
      }
      if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
      }
      console.log(`stdout: ${stdout}`);
  });
}

function copyDirectory(o,d){
  try {
    command = "cp "+o+" "+d+" -r";
    runCMD(command);
  } catch (error) {
    core.setFailed("Error at copy");
  }
}

try {

  const a = core.getInput('action', { required: true });
  const o = core.getInput('origen', { required: false });
  const d = core.getInput('destino', { required: false });
  console.log(`ACTION: ${a}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  if (a == "copyArtifacts") {copyDirectory(o,d)}
  // Get the JSON webhook payload for the event that triggered the workflow
  // const payload = JSON.stringify(github.context.payload, undefined, 2)
  // console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}