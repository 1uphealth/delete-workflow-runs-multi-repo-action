const fetch = require("node-fetch");
const core = require("@actions/core");
const token = core.getInput("token");
const organization = "1uphealth";
const retain_days = Number(core.getInput("retain_days"));
let repositoryArray = JSON.parse(core.getInput("repository_array"));
const owner = "1uphealth";
async function runAnalysis() {
  async function fetchGraphQL(query, variables) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    return response.json();
  }

  async function getActiveBranches() {
    const retentionPeriod = new Date(
      Date.now() - retain_days * 24 * 60 * 60 * 1000
    ).toISOString();
    const branchQuery = `
    query ($organization: String!, $afterCursor: String) {
      organization(login: $organization) {
        repositories(first: 100, after: $afterCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            refs(first: 100, refPrefix: "refs/heads/") {
              nodes {
                name
                target {
                  ... on Commit {
                    committedDate
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

    const branchData = await fetchGraphQL(branchQuery, { organization });
    return branchData.data.organization.repositories.nodes.flatMap((repo) =>
      repo.refs.nodes
        .filter(
          (branch) =>
            new Date(branch.target.committedDate) > new Date(retentionPeriod)
        )
        .map((branch) => ({
          repository: repo.name,
          branch: branch.name,
        }))
    );
  }

  const activeBranches = await getActiveBranches();
  const filteredRuns = await filterWorkflowRuns(activeBranches);
  console.log(filteredRuns);
}

async function fetchWorkflowRuns(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  const data = await response.json();
  return data.workflow_runs;
}

async function deleteWorkflowRun(owner, repo, runId) {
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
      (run) => new Date(run.created_at) < thirtyDaysAgo
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
