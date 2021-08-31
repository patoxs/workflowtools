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


/*
- name: Deploy on cluster k8s
        uses: patoxs/workflowtools@main
        with: 
          action: 'Deploy'
          cluster: c
          deployment: d
          github_ref: gr
          token_github: tk
          ecr: ecr
          branch: br
          namespace: n
*/
const deploy = async function(arreglo){
  const identity = await sts.getCallerIdentity().promise();
  const id_acount = identity.Account;
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ arreglo['cluster'] +" --region "+ process.env.REGION,
      "kubectl run --rm kaniko-"+ arreglo['deployment'] +"-"+ arreglo['cluster'] +" --attach=true --image=gcr.io/kaniko-project/executor:latest \
        --serviceaccount="+ process.env.SERVICE_ACCOUNT +" --restart=Never -- \
        --verbosity=info \
        --context=git://"+ arreglo['token_github'] +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --context=git://"+ arreglo['token_github'] +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --destination="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":"+ github_ref +" \
        --destination="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":latest --git=branch="+ arreglo['branch'],
      "kubectl set image --record deployment.apps/"+ arreglo['deployment'] +" "+ arreglo['deployment'] +"="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":"+ arreglo['github_ref'] +" -n "+ arreglo['namespace'],
      "kubectl rollout status deployment.apps/"+ arreglo['deployment'] +" -n "+ arreglo['namespace'],
    );
    return true;
  } catch (error) {
    core.setFailed("Error al hacer el deploy");
  }
}

/*
- name: Push image to ECR
        uses: patoxs/workflowtools@main
        with: 
          action: 'ECR'
          cluster: c
          deployment: d
          github_ref: 324324
          token_github: tg
          ecr: e
          branch: b
*/
const ecr = async function(arreglo){
  const identity = await sts.getCallerIdentity().promise();
  const id_acount = identity.Account;
  try {
    sequentialExecution(
      "aws eks update-kubeconfig --name "+ arreglo['cluster'] +" --region "+ process.env.REGION,
      "kubectl run --rm kaniko-"+ arreglo['deployment'] +"-"+ arreglo['cluster'] +" --attach=true --image=gcr.io/kaniko-project/executor:latest \
        --serviceaccount="+ process.env.SERVICE_ACCOUNT +" --restart=Never -- \
        --verbosity=info \
        --context=git://"+ arreglo['token_github'] +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --context=git://"+ arreglo['token_github'] +"@github.com/"+ process.env.GITHUB_REPOSITORY +" \
        --destination="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":"+ arreglo['github_ref'] +" \
        --destination="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":latest --git=branch="+ arreglo['branch']
    );
    return true;
  } catch (error) {
    core.setFailed("Error push to ECR");
  }
}

/*
- name: Deploy image xxx to cluster kubernetes
        uses: patoxs/workflowtools@main
        with: 
          action: 'K8S'
          deployment: d
          ecr: e
          github_ref: 324324
          namespace: na
*/
const kubernetes = async function(arreglo){
  const identity = await sts.getCallerIdentity().promise();
  const id_acount = identity.Account;
  sequentialExecution(
    "kubectl set image --record deployment.apps/"+ arreglo['deployment'] +" "+ arreglo['deployment'] +"="+ id_acount +".dkr.ecr."+ process.env.REGION +".amazonaws.com/"+ arreglo['ecr'] +":"+ arreglo['github_ref'] +" -n "+ arreglo['namespace'],
    "kubectl rollout status deployment.apps/"+ arreglo['deployment'] +" -n "+ arreglo['nanespace'],
  );
  return true;        
}


try {
  var arreglo = [];
  var gr   = process.env.GITHUB_REPOSITORY;
  
  arreglo['action']       = core.getInput('action', { required: true });
  arreglo['namespace']    = core.getInput('namespace', { required: false });
  arreglo['branch']       = core.getInput('branch', { required: false });
  arreglo['ecr']          = core.getInput('ecr', { required: false });
  arreglo['token_github'] = core.getInput('token_github', { required: false });
  arreglo['deployment']   = core.getInput('deployment', { required: false });
  arreglo['github_ref']   = core.getInput('github_ref', { required: false});
  arreglo['cluster']      = core.getInput('cluster', { required: false});

  if ( arreglo['cluster'] == 'default' ) {
    arreglo['cluster'] = process.env.CLUSTER;
  }
  if( arreglo['github_ref'] == '0.0.0' ) {
    arreglo['github_ref'] = process.env.GITHUB_SHA.slice(4, 14);
  } else {
    const words = arreglo['github_ref'].split('/');
    arreglo['github_ref'] = words[2];
  }

  const time = (new Date()).toTimeString();

  core.setOutput("time", time);

  if (arreglo['action'] == "K8S") {kubernetes(arreglo)}
  if (arreglo['action'] == "ECR") {ecr(arreglo)}
  if (arreglo['action'] == "Deploy") {deploy(arreglo)}
  if (arreglo['action'] == "default"){
    console.log(process.env);
  }
} catch (error) {
  core.setFailed(error.message);
}

