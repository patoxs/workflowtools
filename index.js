const core = require('@actions/core');
const github = require('@actions/github');
const AWS = require('aws-sdk');
const sts = new AWS.STS();
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

function confK8S(c, n){
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ c +" --region "+ process.env.REGION,
      "kubectl config set-context --current --namespace="+n,
    );
    return true;
  } catch (error) {
    core.setFailed("Error at copy");
  }
}

async function uploadKanikoECR(branch, tag, app_name) {
  const identity = await sts.getCallerIdentity().promise();
  const ai = i.Account;
  var sa = process.env.SERVICE_ACCOUNT;
  console.log("repo" + app_name);
  var command = "kubectl run --rm kaniko-"+ app_name +"-"+ tag +" --attach=true --image=gcr.io/kaniko-project/executor:latest --serviceaccount="+ sa +" --restart=Never -- \
        --verbosity=info \
        --context=git://"+ process.env.TOKEN +"@github.com/"+ app_name +" \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ app_name +":"+ tag +" \
        --destination="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ app_name +":latest --git=branch="+ branch +" "
  sequentialExecution( command );
}

function deployK8s(tag, app_name, n){
  const identity = await sts.getCallerIdentity().promise();
  const ai = i.Account;
  sequentialExecution(
    "kubectl set image --record deployment.apps/php php="+ ai +".dkr.ecr.us-west-2.amazonaws.com/"+ app_name +":"+ tag +" -n "+ n,
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

  console.log(`ACTION: ${a}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  if (a == "copyArtifacts") {copyDirectory(o,d)}
  if (a == "confK8S") {confK8S(c,n)}
  if (a == "pushECR") {uploadKanikoECR(b,tag,an)}
  if (a == "deployK8s") {deployK8s(tag,an,n)}
  if (a == "default"){
    console.log(${payload});
    console.log(process.env);
  }
  
} catch (error) {
  core.setFailed(error.message);
}