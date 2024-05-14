async function runAnalysis() {
  const fetch = require("node-fetch");
  const core = require("@actions/core");
  const token = core.getInput("token");
  const organization = "1uphealth";
  const retain_days = Number(core.getInput("retain_days"));

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
    console.log(branchData);
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

  async function filterWorkflowRuns(activeBranches) {
    const workflowQuery = `
    query ($organization: String!, $afterCursor: String) {
      organization(login: $organization) {
        repositories(first: 100, after: $afterCursor) {
          nodes {
            name
            workflowRuns(first: 10) {
              nodes {
                id
                workflow {
                  name
                }
                createdAt
                conclusion
                url
                headBranch
              }
            }
          }
        }
      }
    }
  `;

    const workflowData = await fetchGraphQL(workflowQuery, { organization });
    return workflowData.data.organization.repositories.nodes.flatMap((repo) =>
      repo.workflowRuns.nodes.filter(
        (run) =>
          !activeBranches.some(
            (ab) => ab.repository === repo.name && ab.branch === run.headBranch
          )
      )
    );
  }

  const activeBranches = await getActiveBranches();
  const filteredRuns = await filterWorkflowRuns(activeBranches);
  console.log(filteredRuns);
}

runAnalysis();
