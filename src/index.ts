import { getInput } from "@actions/core";
import { Octokit } from "@octokit/rest";

const token = getInput("token");
const retain_days = Number(getInput("retain_days"));
let repositoryArray = JSON.parse(getInput("repository_array"));
const owner = "1uphealth";

const octokit = new Octokit({
  auth: token,
});
async function fetchWorkflowRuns(owner: string, repo: string) {
  let response = await octokit.request(
    `GET /repos/${owner}/${repo}/actions/runs`,
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  const data = await response.data;
  console.log(data);
  return data.workflow_runs;
}

async function deleteWorkflowRun(owner: string, repo: string, runId: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (response.ok) {
    console.log(`Deleted run ${runId} from ${repo}`);
  } else {
    console.error(
      `Failed to delete run ${runId} from ${repo}: ${response.statusText}`
    );
  }
}

async function processRuns() {
  for (const repo of repositoryArray) {
    console.log(repo);
    const runs = await fetchWorkflowRuns(owner, repo);
    const thirtyDaysAgo = new Date(
      Date.now() - retain_days * 24 * 60 * 60 * 1000
    );
    console.log(runs);
    const filteredRuns = runs.filter(
      (run: any) => new Date(run.created_at) < thirtyDaysAgo
    );

    // Add branch filtering logic here if you have data on active branches

    for (const run of filteredRuns) {
      console.log(run.id);
      //   await deleteWorkflowRun(owner, repo, run.id);
    }
  }
}

processRuns();

// runAnalysis();
