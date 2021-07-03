const core = require('@actions/core');
const github = require('@actions/github');
const AWS = require('aws-sdk');
const sts = new AWS.STS();
const {promisify} = require('util');
const {exec} = require('child_process');
const execAsync = promisify(exec);
const sequentialExecution = async (...commands) => {
  if (commands.length === 0) {
    return 0;
  }

  const {stderr} = await execAsync(commands.shift());
  if (stderr) {
    throw stderr;
  }

  return sequentialExecution(...commands);
}

function hash() {
  return uuid.v4().substring(25, 37);
}

function copyDirectory(o,d){
  var command = "cp "+o+" "+d+" -r";
  try {
    sequentialExecution(command);
    return true;
  } catch (error) {
    core.setFailed("Error at copy");
  }
}

function confK8S(c, n, r ){
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ c +" --region "+ r,
      "kubectl config set-context --current --namespace="+n,
    );
    return true;
  } catch (error) {
    core.setFailed("Error at copy");
  }
}


async function uploadKanikoECR() {
  const identity = await sts.getCallerIdentity().promise();
  const ai = i.Account;
  const t = hash();
  var command = "kubectl run --rm kaniko-${APP_NAME}-"+ t +" --attach=true --image=gcr.io/kaniko-project/executor:latest --serviceaccount=${EKS_SAN} --restart=Never -- \
        --verbosity=info \
        --context=git://${{ secrets.TOKENKEY_GITHUB }}@github.com/${GITHUB_REPOSITORY} \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/${IMAGE_REPOSITORY_NAME}:"+ t +" \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/${IMAGE_REPOSITORY_NAME}:latest --git=branch=${GITHUB_BRANCH}"
  return accountId;
}


try {

  const a = core.getInput('action', { required: true });
  const o = core.getInput('origin', { required: false });
  const d = core.getInput('destiny', { required: false });
  const c = core.getInput('cluster', { required: false });
  const n = core.getInput('namespace', { required: false });
  const r = core.getInput('region', { required: false });

  console.log(`ACTION: ${a}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  if (a == "copyArtifacts") {copyDirectory(o,d)}
  if (a == "confK8S") {confK8S(c,n,r)}
  // Get the JSON webhook payload for the event that triggered the workflow
  // const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload.repository.name}`);
} catch (error) {
  core.setFailed(error.message);
}