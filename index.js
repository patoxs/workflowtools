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
    core.setFailed("Error at copy");
  }
}

const ConfK8SPushEcr = async function(c, n, branch, tag, app_name, repo){
  const identity = await sts.getCallerIdentity().promise();
  const ai = identity.Account;
  var kaniko = "kubectl run --rm kaniko-"+ app_name +"-"+ tag +" --attach=true --image=gcr.io/kaniko-project/executor:latest --serviceaccount="+ process.env.SERVICE_ACCOUNT +" --restart=Never -- \
        --verbosity=info \
        --context=git://"+ process.env.TOKEN +"@github.com/"+ app_name +" \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ repo +":"+ tag +" \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ repo +":latest --git=branch="+ branch +" "
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ c +" --region "+ process.env.REGION,
      "kubectl config set-context --current --namespace="+n,
      kaniko
    );
    return true;
  } catch (error) {
    core.setFailed("Error at copy");
  }
}



const deployK8s = async function(tag, app_name, n, repo){
  const identity = await sts.getCallerIdentity().promise();
  const ai = identity.Account;
  sequentialExecution(
    "kubectl set image --record deployment.apps/php php="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ repo +":"+ tag +" -n "+ n,
    "kubectl rollout status deployment.apps/php -n "+ n,
  );
  return true;        
}

  // - name: default
  //       uses: patoxs/workflowtools@main
  //       with: 
  //         action: 'default'
  // - name: copy to artifacts
  //       uses: patoxs/workflowtools@main
  //       with: 
  //         action: 'copyArtifacts' 
  //         origin: 'path/directory/origin' 
  //         destiny: 'path/directory/destiny'
  // - name: configue k8s in runner
  //       uses: patoxs/workflowtools@main
  //       with: 
  //         action: 'confK8S'
  //         namespace: 'name_namespace'
  // - name: Upload image to ECR
  //       uses: patoxs/workflowtools@main
  //       with: 
  //         action: 'pushECR'
  //         branch: 'branch_to_deploy'
  //         app_name: 'app_name_or_ecr_name'
  // - name: Deploy to K8s
  //       uses: patoxs/workflowtools@main
  //       with: 
  //         action: 'deployK8s'
  //         app_name: 'app_name_or_ecr_name'
  //         namespace: 'name_namespace'

try {

  const tag = hash();
  var gr = process.env.GITHUB_REPOSITORY;
  var c = process.env.CLUSTER;
  const a = core.getInput('action', { required: true });
  const o = core.getInput('origin', { required: false });
  const d = core.getInput('destiny', { required: false });
  const n = core.getInput('namespace', { required: false });
  const b = core.getInput('branch', { required: false });
  const an = core.getInput('app_name', { required: false });
  const r = core.getInput('repo', { required: false });

  console.log(`ACTION: ${a}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  if (a == "copyArtifacts") {copyDirectory(o,d)}
  if (a == "ConfPushECR") {ConfK8SPushEcr(c, n, b, tag, an, r)}
  if (a == "deployK8s") {deployK8s(tag,an,n, r)}
  if (a == "default"){
    console.log(process.env);
  }
  
} catch (error) {
  core.setFailed(error.message);
}