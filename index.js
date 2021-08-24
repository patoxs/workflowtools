const core = require('@actions/core');
const github = require('@actions/github');
const AWS = require('aws-sdk');
const sts = new AWS.STS();
const uuid = require('uuid');
const {promisify} = require('util');
const {exec} = require('child_process');
const execAsync = promisify(exec)
const payload = JSON.stringify(github.context.payload, undefined, 2);
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
    core.setFailed(error.message);
  }
}

const ToECR = async function(github_ref, cluster, app_name, token, repo, branch){
  const identity = await sts.getCallerIdentity().promise();
  const id_count = identity.Account;
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ cluster +" --region "+ process.env.REGION,
      "kubectl run --rm kaniko-"+ app_name +"-"+ github_ref +" --attach=true --image=gcr.io/kaniko-project/executor:latest \
        --serviceaccount="+ process.env.SERVICE_ACCOUNT +" --restart=Never -- \
        --verbosity=info \
        --context=git://"+ token +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --destination="+ id_count +".dkr.ecr.us-west-2.amazonaws.com/"+ repo +":"+ github_ref +" \
        --destination="+ id_count +".dkr.ecr.us-west-2.amazonaws.com/"+ repo +":latest --git=branch="+ branch
    );
    return true;
  } catch (error) {
    core.setFailed("Error push to ECR");
  }
}

const ConfK8SPushEcr = async function(c, n, branch, app_name, repo, tg){
  const tag = process.env.GITHUB_SHA.slice(4, 14);
  const identity = await sts.getCallerIdentity().promise();
  const ai = identity.Account;
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ c +" --region "+ process.env.REGION,
      "kubectl run --rm kaniko-"+ app_name +"-"+ tag +" --attach=true --image=gcr.io/kaniko-project/executor:latest \
        --serviceaccount="+ process.env.SERVICE_ACCOUNT +" --restart=Never -- \
        --verbosity=debug \
        --context=git://"+ tg +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --context=git://"+ tg +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --destination="+ ai +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ repo +":"+ tag +" \
        --destination="+ ai +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ repo +":latest --git=branch="+ branch
    );
    return true;
  } catch (error) {
    core.setFailed(error.message);
    return false;
  }
}

const deployK8s = async function(n, repo, de){
  const tag = process.env.GITHUB_SHA.slice(4, 14);
  const identity = await sts.getCallerIdentity().promise();
  const ai = identity.Account;
  sequentialExecution(
    "kubectl set image --record deployment.apps/"+ de +" "+ de +"="+ ai +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ repo +":"+ tag +" -n "+ n,
    "kubectl rollout status deployment.apps/"+ de +" -n "+ n,
  );
  return true;        
}

try {
  var gr           = process.env.GITHUB_REPOSITORY;
  var c            = process.env.CLUSTER;
  const a          = core.getInput('action', { required: true });
  const o          = core.getInput('origen', { required: false });
  const d          = core.getInput('destino', { required: false });
  const n          = core.getInput('namespace', { required: false });
  const b          = core.getInput('branch', { required: false });
  const an         = core.getInput('app_name', { required: false });
  const r          = core.getInput('repo', { required: false });
  const tg         = core.getInput('token', { required: false });
  const de         = core.getInput('deployment', { required: false });
  const github_ref = core.getInput('github_ref'. { required: false});

  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  if (a == "copyArtifacts") {copyDirectory(o,d)}
  if (a == "ConfPushECR") {ConfK8SPushEcr(c, n, b, an, r, tg)}
  if (a == "deployK8s") {deployK8s(n, r, de)}
  if (a == "ToECR") {ToECR(github_ref, c, an, tg, r, b)}
  if (a == "default"){
    console.log(process.env);
  }
} catch (error) {
  core.setFailed(error.message);
}
