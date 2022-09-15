import { gql, GraphQLClient } from "graphql-request";
import type { LoaderFunction, MetaFunction } from "remix";
import { useLoaderData } from "remix";

const GROUPS = [
  {
    name: "🤖 Dependabot",
    query: "label:dependencies",
  },
  { name: "📝 Drafts", query: "draft:true" },
  {
    name: "❌ Failing checks",
    query: "draft:false status:failure -label:dependencies",
  },
  {
    name: "🚧 Awaiting changes",
    query: "draft:false review:changes_requested",
  },
  {
    name: "👀 Ready for review",
    query: "draft:false -status:failure review:none -head:changeset-release/main -label:dependencies",
  },
  {
    name: "🚀 Ready to merge",
    query: "draft:false -status:failure review:approved",
  },
  {
    name: "🔜 Next release",
    query: "head:changeset-release/main",
  },
];

async function searchGithub(query: string) {
  // TODO: Implement oauth
  const githubClient = new GraphQLClient("https://api.github.com/graphql", {
    headers: {
      Authorization: `bearer ${process.env.GITHUB_PAT}`,
    },
  });

  const searchQuery = gql`
    query ($query: String!) {
      search(first: 50, type: ISSUE, query: $query) {
        nodes {
          ... on PullRequest {
            title
            url
            author {
              login
            }
          }
        }
      }
    }
  `;

  return await githubClient.request<{
    search: {
      nodes: Array<{ title: string; url: string; author: { login: string } }>;
    };
  }>(searchQuery, { query });
}

type PageData = {
  repository: string;
  data: Array<{
    name: string;
    query: string;
    results: Array<{ title: string; url: string; author: { login: string } }>;
  }>;
};

export let loader: LoaderFunction = async ({ params }) => {
  const { owner, name } = params;

  const repository = `${owner}/${name}`;

  const data = await Promise.all(
    GROUPS.map(async ({ name, query }) => {
      const data = await searchGithub(
        `repo:${repository} is:pr is:open ${query}`
      );
      return {
        name,
        query,
        results: data.search.nodes,
      };
    })
  );

  return { repository, data };
};

export let meta: MetaFunction = ({ data }) => {
  return {
    title: `${data.repository} pull requests`,
  };
};

export default function Index() {
  let { repository, data } = useLoaderData<PageData>();

  return (
    <div style={{ padding: 16, width: '40rem', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>
        <a href={`https://github.com/${repository}`}>{repository}</a> pull
        requests
      </h1>
      <div>
        {data.map(({ name, results }) => (
          <details key={name}>
            <summary>
              <strong style={{ fontSize: '1.5rem' }}>{name} ({results.length})</strong>
            </summary>
            <ul>
              {results.map(({ title, url, author }) => (
                <li key={title}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {title}
                  </a>{" "}
                  by {author.login}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
